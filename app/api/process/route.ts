import { NextRequest, NextResponse } from 'next/server';
import { DealItem, updateRowStatusInController, updateRowLeadsFolderInController } from '@/lib/sheets-client';
import { generatePRExcelBuffer } from '@/lib/pr-builder';
import { generateAgreementPdfBuffer } from '@/lib/agreement-builder';
import { isDriveFolderAccessible, processDealDriveWorkflow, getOrCreateFinanceLeadFolder } from '@/lib/drive-client';
import { KPR_CONFIG } from '@/lib/kpr-config';

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
        await generatePRExcelBuffer(deal);

        let prUrl = '';
        let folderUrl = '';
        let leadsFolderUrl = deal.leadsFolderUrl || '';

        // 3. Jika Google Drive terhubung, sinkronkan langsung ke Google Drive
        if (driveConnected) {
          const driveRes = await processDealDriveWorkflow(deal, agreementPdfBuffer);
          prUrl = driveRes.prUrl;
          folderUrl = driveRes.folderUrl;

          // Jika diminta sekalian buat Folder Leads Finance
          if (syncLeadsFolder) {
            try {
              const leadsFolder = await getOrCreateFinanceLeadFolder(deal.moCode || '', deal.customerName);
              leadsFolderUrl = leadsFolder.url;
              await updateRowLeadsFolderInController(deal.row, leadsFolder.url, leadsFolder.name);
            } catch (e) {
              console.warn(`Peringatan: Gagal membuat leads folder untuk ${deal.customerName}:`, e);
            }
          }
        }

        // 4. Update Controller Sheet (Row & Partner Row jika ada)
        // Menyimpan rumus HYPERLINK ke file PR di Drive, entitas PT, dan nominal
        await updateRowStatusInController(
          deal.row,
          deal.partnerRow,
          prUrl,
          deal.company,
          deal.targetAmount
        );

        results.push({
          row: deal.row,
          customerName: deal.customerName,
          success: true,
          prUrl,
          folderUrl,
          leadsFolderUrl,
          driveSynced: driveConnected
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
