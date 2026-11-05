import { NextRequest, NextResponse } from 'next/server';
import { CashbackDealItem, processCashbackDealWorkflow } from '@/lib/cashback-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const deals: CashbackDealItem[] = body.deals || [];

    if (deals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada nasabah cashback yang dipilih.' },
        { status: 400 }
      );
    }

    const results = [];

    for (const deal of deals) {
      try {
        const res = await processCashbackDealWorkflow(deal);
        results.push({
          row: deal.row,
          dbRow: deal.dbRow,
          customerName: deal.customerName,
          folderUrl: res.folderUrl,
          prUrl: res.prUrl,
          memoAttached: res.memoAttached,
          success: res.isSuccess
        });
      } catch (err: any) {
        console.error(`Error processing cashback for ${deal.customerName}:`, err);
        results.push({
          row: deal.row,
          dbRow: deal.dbRow,
          customerName: deal.customerName,
          error: err.message || 'Gagal memproses cashback nasabah.',
          success: false
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.filter(r => r.success).length,
      results
    });
  } catch (err: any) {
    console.error('Error in /api/cashback/process:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Terjadi kesalahan sistem saat memproses cashback.' },
      { status: 500 }
    );
  }
}
