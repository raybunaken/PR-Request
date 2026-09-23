import { NextResponse } from 'next/server';
import { isDriveFolderAccessible } from '@/lib/drive-client';
import { KPR_CONFIG } from '@/lib/kpr-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accessible = await isDriveFolderAccessible(KPR_CONFIG.REFERRAL_FEE_AGENT_FOLDER_ID);
    return NextResponse.json({
      success: true,
      connected: accessible,
      folderId: KPR_CONFIG.REFERRAL_FEE_AGENT_FOLDER_ID,
      serviceAccountEmail: KPR_CONFIG.SERVICE_ACCOUNT_EMAIL
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: err.message || 'Gagal memeriksa status Google Drive',
      serviceAccountEmail: KPR_CONFIG.SERVICE_ACCOUNT_EMAIL
    });
  }
}
