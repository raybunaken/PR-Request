import { NextRequest, NextResponse } from 'next/server';
import { fetchAllCashbackDeals } from '@/lib/cashback-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const deals = await fetchAllCashbackDeals();

    const summary = {
      total: deals.length,
      synced: deals.filter(d => d.syncStatus === 'SINKRON').length,
      missing: deals.filter(d => d.syncStatus === 'BELUM_ADA').length,
      withFolder: deals.filter(d => d.hasFolder).length,
      withMemo: deals.filter(d => d.hasMemo).length,
      withPr: deals.filter(d => d.hasPr).length,
    };

    return NextResponse.json({
      success: true,
      deals,
      summary
    });
  } catch (err: any) {
    console.error('Error in /api/cashback:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Gagal memuat data transaksi Cashback KPR dari Google Sheets.'
      },
      { status: 500 }
    );
  }
}
