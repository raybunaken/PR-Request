import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateFinanceLeadFolder, checkFilesInLeadFolder } from '@/lib/drive-client';
import { updateRowLeadsFolderInController } from '@/lib/sheets-client';
import { KPR_CONFIG } from '@/lib/kpr-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ success: false, error: 'folderId wajib disertakan' }, { status: 400 });
    }

    const fileCheck = await checkFilesInLeadFolder(folderId);
    return NextResponse.json({ success: true, folderId, fileCheck });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Mendukung single item maupun batch
    const items = body.items || (body.customerName ? [body] : []);

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada nasabah yang dipilih untuk pembuatan Folder Leads.' },
        { status: 400 }
      );
    }

    const globalFetchFromGmail = body.fetchFromGmail ?? true;
    const results = [];

    for (const item of items) {
      const { row, customerName, moCode, bankName, customSpaQuery, customBankQuery } = item;
      const shouldFetchGmail = item.fetchFromGmail ?? globalFetchFromGmail;

      if (!customerName) continue;

      try {
        // 1. Dapatkan atau buat folder di Google Drive (Folder Root: Leads Akad Automation)
        const folder = await getOrCreateFinanceLeadFolder(moCode || '', customerName);

        // 2. Tarik SPA Signed dan Email Konfirmasi Bank via Google Apps Script (Gmail dzaky.rayssa@99.co)
        let gasResult = null;
        if (shouldFetchGmail && KPR_CONFIG.APPS_SCRIPT_WEBAPP_URL) {
          try {
            const gasRes = await fetch(KPR_CONFIG.APPS_SCRIPT_WEBAPP_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'fetch_spa_and_email',
                folderId: folder.id,
                customerName: customerName,
                bankName: bankName || '',
                moCode: moCode || '',
                customSpaQuery: customSpaQuery || '',
                customBankQuery: customBankQuery || ''
              }),
              redirect: 'follow'
            });
            gasResult = await gasRes.json();
          } catch (gasErr: any) {
            console.warn(`Gagal memanggil Apps Script untuk ${customerName}:`, gasErr.message);
            gasResult = { success: false, error: gasErr.message };
          }
        }

        // 3. Periksa kelengkapan file SPA Signed dan Konfirmasi Bank di Google Drive
        const fileCheck = await checkFilesInLeadFolder(folder.id);

        // 4. Update Kolom J pada sheet controller (Daftar Transaksi KPR) jika ada baris controller
        if (row && row > 1) {
          await updateRowLeadsFolderInController(row, folder.url, folder.name);
        }

        results.push({
          row,
          customerName,
          success: true,
          folder,
          gasResult,
          fileCheck
        });
      } catch (err: any) {
        console.error(`Gagal memproses folder leads untuk ${customerName}:`, err);
        results.push({
          row,
          customerName,
          success: false,
          error: err.message || 'Gagal memproses folder di Google Drive'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (err: any) {
    console.error('Error in /api/leads-folder:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
