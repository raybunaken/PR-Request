import { NextRequest, NextResponse } from 'next/server';
import { fetchAllDeals } from '@/lib/sheets-client';
import { generatePRExcelBuffer } from '@/lib/pr-builder';
import { generateAgreementPdfBuffer } from '@/lib/agreement-builder';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rowParam = searchParams.get('row');
    const type = searchParams.get('type'); // 'pr' | 'agreement'

    if (!rowParam || !type) {
      return NextResponse.json({ error: 'Parameter row dan type wajib disertakan.' }, { status: 400 });
    }

    const rowNumber = parseInt(rowParam, 10);
    const allDeals = await fetchAllDeals();
    const deal = allDeals.find(d => d.row === rowNumber);

    if (!deal) {
      return NextResponse.json({ error: `Nasabah pada baris ${rowNumber} tidak ditemukan.` }, { status: 404 });
    }

    const safeName = deal.customerName.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (type === 'pr') {
      const buffer = await generatePRExcelBuffer(deal);
      const filename = `PR_Request_${deal.agentName.replace(/\s+/g, '_')}_${safeName}.xlsx`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } else if (type === 'agreement') {
      const buffer = await generateAgreementPdfBuffer(deal);
      const filename = `Agreement_${deal.agentName.replace(/\s+/g, '_')}_${safeName}.pdf`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    return NextResponse.json({ error: 'Tipe dokumen tidak valid. Gunakan "pr" atau "agreement".' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/download:', err);
    return NextResponse.json({ error: err.message || 'Gagal mengunduh berkas.' }, { status: 500 });
  }
}
