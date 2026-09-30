import { NextRequest, NextResponse } from 'next/server';
import { DealItem, updateRowStatusInController, updateRowLeadsFolderInController } from '@/lib/sheets-client';
import { generatePRExcelBuffer } from '@/lib/pr-builder';
import { generateAgreementPdfBuffer } from '@/lib/agreement-builder';
import { isDriveFolderAccessible, processDealDriveWorkflow, getOrCreateFinanceLeadFolder } from '@/lib/drive-client';
import { KPR_CONFIG, resolveAgent } from '@/lib/kpr-config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const deals: DealItem[] = body.deals || [];
    const syncLeadsFolder: boolean = !!body.syncLeadsFolder;

    if (deals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada nasabah yang dipilih.' },
        { status: 400 }
      );
    }

    // Periksa apakah folder Google Drive sudah dapat diakses oleh Service Account
    const driveConnected = await isDriveFolderAccessible(KPR_CONFIG.REFERRAL_FEE_AGENT_FOLDER_ID);

    const results = [];

    for (const deal of deals) {
      try {
        // 1. Generate Agreement PDF (4 Halaman Utuh, 2 Bagian Lampiran)
        const agreementPdfBuffer = await generateAgreementPdfBuffer(deal);

        // 2. Generate PR Excel Buffer
        const prExcelBuffer = await generatePRExcelBuffer(deal);

        let prUrl = '';
        let agreementUrl = '';
        let folderUrl = '';
        let leadsFolderUrl = deal.leadsFolderUrl || '';
        let targetFolderId = '';

        // 3. Jika Google Drive terhubung, buat folder nasabah dan pasang shortcut dokumen
        if (driveConnected) {
          try {
            const driveRes = await processDealDriveWorkflow(deal, agreementPdfBuffer);
            prUrl = driveRes.prUrl || '';
            agreementUrl = driveRes.agreementUrl || '';
            folderUrl = driveRes.folderUrl || '';
            targetFolderId = driveRes.folderId || '';
            
            if (!targetFolderId && folderUrl) {
              const m = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
              if (m) targetFolderId = m[1];
            }
          } catch (driveErr) {
            console.warn(`Drive direct sync skipped:`, driveErr);
          }

          // 3b. Unggah berkas PR Excel & Agreement PDF via Google Apps Script Web App
          // (Menembus limit kuota storage Service Account dengan akun Google Workspace pengguna)
          if ((!prUrl || !agreementUrl) && targetFolderId && KPR_CONFIG.APPS_SCRIPT_WEBAPP_URL) {
            try {
              const agent = resolveAgent(deal.percentage);
              const cleanCust = deal.customerName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
              const prFileName = `PR Request - Referral Fee Agent a.n. ${agent.name} - ${cleanCust}.xlsx`;
              const agreementFileName = `Agreement Pembagian Komisi Agent - ${agent.name} - ${cleanCust}.pdf`;

              const gasRes = await fetch(KPR_CONFIG.APPS_SCRIPT_WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  folderId: targetFolderId,
                  customerName: deal.customerName,
                  company: deal.company,
                  bankName: deal.bank || '',
                  agentName: agent.name,
                  agentPayeeName: agent.payeeName,
                  agentBankName: agent.bankName,
                  agentAccountNumber: agent.accountNumber,
                  agentAccountName: agent.accountName,
                  amount: deal.targetAmount,
                  prFileName: `PR Request - Referral Fee Agent a.n. ${agent.name} - ${cleanCust}`,
                  agreementFileName: agreementFileName,
                  agreementBase64: agreementPdfBuffer.toString('base64')
                }),
                redirect: 'follow'
              });

              if (gasRes.ok) {
                const gasData = await gasRes.json();
                if (gasData.success) {
                  if (gasData.prUrl) prUrl = gasData.prUrl;
                  if (gasData.agreementUrl) agreementUrl = gasData.agreementUrl;
                }
              }
            } catch (gasErr: any) {
              console.warn(`Peringatan: Gagal memanggil Apps Script untuk ${deal.customerName}:`, gasErr.message);
            }
          }

          // Jika diminta sekalian buat Folder Leads Finance
          if (syncLeadsFolder) {
            try {
              const leadsFolder = await getOrCreateFinanceLeadFolder(deal.moCode || '', deal.customerName);
              leadsFolderUrl = leadsFolder.url;
              await updateRowLeadsFolderInController(deal.row, leadsFolder.url, leadsFolder.name);

              // Tarik SPA dan Email Bank dari Gmail via Apps Script
              if (KPR_CONFIG.APPS_SCRIPT_WEBAPP_URL) {
                try {
                  await fetch(KPR_CONFIG.APPS_SCRIPT_WEBAPP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'fetch_spa_and_email',
                      folderId: leadsFolder.id,
                      customerName: deal.customerName,
                      bankName: deal.bank || '',
                      moCode: deal.moCode || ''
                    }),
                    redirect: 'follow'
                  });
                } catch (gasErr: any) {
                  console.warn(`Gagal fetch Gmail untuk ${deal.customerName}:`, gasErr.message);
                }
              }
            } catch (e) {
              console.warn(`Peringatan: Gagal membuat leads folder untuk ${deal.customerName}:`, e);
            }
          }
        }

        // 4. Update Controller Sheet (Row & Partner Row jika ada)
        // Menyimpan rumus HYPERLINK ke Folder PR di Drive (agar attachment & dokumen lengkap langsung dapat diperiksa), entitas PT, dan nominal
        await updateRowStatusInController(
          deal.row,
          deal.partnerRow,
          folderUrl || prUrl,
          deal.company,
          deal.targetAmount,
          prUrl
        );

        const downloadPrUrl = `/api/download?row=${deal.row}&type=pr`;
        const downloadAgreementUrl = `/api/download?row=${deal.row}&type=agreement`;

        results.push({
          row: deal.row,
          customerName: deal.customerName,
          success: true,
          prUrl,
          folderUrl,
          leadsFolderUrl,
          downloadPrUrl,
          downloadAgreementUrl,
          driveSynced: driveConnected && !!prUrl,
          driveQuotaLimited: driveConnected && !prUrl
        });
      } catch (err: any) {
        console.error(`Gagal memproses nasabah ${deal.customerName}:`, err);
        results.push({
          row: deal.row,
          customerName: deal.customerName,
          success: false,
          error: err.message || 'Gagal memproses dokumen'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      driveConnected,
      serviceAccountEmail: KPR_CONFIG.SERVICE_ACCOUNT_EMAIL,
      successCount,
      failCount: results.length - successCount,
      results
    });
  } catch (err: any) {
    console.error('Error in /api/process:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Terjadi kesalahan pada server saat memproses batch.' },
      { status: 500 }
    );
  }
}
