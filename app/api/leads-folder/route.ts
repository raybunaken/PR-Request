import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateFinanceLeadFolder, checkFilesInLeadFolder } from '@/lib/drive-client';
import { updateRowLeadsFolderInController } from '@/lib/sheets-client';

export const dynamic = 'force-dynamic';

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

    const results = [];

    for (const item of items) {
      const { row, customerName, moCode, bankName } = item;

      if (!customerName) continue;

      try {
        // 1. Dapatkan atau buat folder di Google Drive (Folder Root: Leads Akad Automation)
        const folder = await getOrCreateFinanceLeadFolder(moCode || '', customerName);

        // 2. Periksa kelengkapan file SPA Signed dan Konfirmasi Bank
        const fileCheck = await checkFilesInLeadFolder(folder.id);

        // 3. Update Kolom J pada sheet controller (Daftar Transaksi KPR) jika ada baris controller
        if (row && row > 1) {
          await updateRowLeadsFolderInController(row, folder.url, folder.name);
        }

        results.push({
          row,
          customerName,
          success: true,
          folder,
          fileCheck
        });
      } catch (err: any) {
        console.error(`Gagal membuat folder leads untuk ${customerName}:`, err);
        results.push({
          row,
          customerName,
          success: false,
          error: err.message || 'Gagal membuat folder di Google Drive'
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
