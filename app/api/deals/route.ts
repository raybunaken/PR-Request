import { NextRequest, NextResponse } from 'next/server';
import { fetchAllDeals } from '@/lib/sheets-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tabParam = searchParams.get('tab');
    const tab = (tabParam === 'all' ? 'all' : 'agent') as 'agent' | 'all';

    const deals = await fetchAllDeals(tab);

    const summary = {
      total: deals.length,
      outdated: deals.filter(d => d.syncStatus === 'PERLU_TIMPA').length,
      synced: deals.filter(d => d.syncStatus === 'SINKRON').length,
      missing: deals.filter(d => d.syncStatus === 'BELUM_ADA').length,
      withFolder: deals.filter(d => d.hasLeadsFolder).length,
    };

    return NextResponse.json({
      success: true,
      tab,
      deals,
      summary
    });
  } catch (err: any) {
    console.error('Error in /api/deals:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Gagal memuat data transaksi KPR dari Google Sheets.'
      },
      { status: 500 }
    );
  }
}
