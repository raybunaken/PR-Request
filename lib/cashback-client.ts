import { google } from 'googleapis';
import { 
  KPR_CONFIG, 
  getCompanyByBank, 
  getEntityCodeByBank, 
  parseNumberClean 
} from './kpr-config';
import { getSheetsService } from './sheets-client';
import { getDriveService, findFolderInParent, createFolderInParent } from './drive-client';

export interface CashbackDealItem {
  row: number;
  dbRow: number;
  customerName: string;
  tglAkad: string;
  bank: string;
  plafond: number;
  cashbackAmount: number;
  moCode?: string;
  phone?: string;
  company: string;
  entity: 'NND' | 'WMI';
  hasFolder: boolean;
  folderId?: string;
  folderUrl?: string;
  hasMemo: boolean;
  memoName?: string;
  memoUrl?: string;
  hasPr: boolean;
  prUrl?: string;
  prFileId?: string;
  syncStatus: 'SINKRON' | 'BELUM_ADA';
  statusLeadsCashback?: string;
}

/**
 * Normalisasi string nama untuk pencocokan folder
 */
function cleanName(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Mengambil seluruh transaksi yang berhak mendapatkan Cashback dari Google Sheets
 * Memeriksa status keberadaan folder, shortcut memo, dan berkas PR di Google Drive
 */
export async function fetchAllCashbackDeals(): Promise<CashbackDealItem[]> {
  const sheets = await getSheetsService();
  const drive = await getDriveService();

  // 1. Ambil data dari 'All - Akad Transaction'
  const akadRes = await sheets.spreadsheets.values.get({
    spreadsheetId: KPR_CONFIG.AKAD_SPREADSHEET_ID,
    range: "'All - Akad Transaction'!A1:AJ500"
  });
  const akadRows = akadRes.data.values || [];

  // 2. Ambil data dari tab 'Leads Cashback' jika ada
  let leadsCbMap: Record<string, { progress: string; folder: string; rowNum: number }> = {};
  try {
    const cbRes = await sheets.spreadsheets.values.get({
      spreadsheetId: KPR_CONFIG.AKAD_SPREADSHEET_ID,
      range: "'Leads Cashback'!A1:J100"
    });
    const cbRows = cbRes.data.values || [];
    for (let i = 1; i < cbRows.length; i++) {
      const r = cbRows[i];
      const cust = String(r[0] || '').trim();
      if (cust) {
        leadsCbMap[cleanName(cust)] = {
          progress: String(r[7] || '').trim(),
          folder: String(r[9] || '').trim(),
          rowNum: i + 1
        };
      }
    }
  } catch (err: any) {
    console.warn('[Cashback] Tab Leads Cashback belum tersedia / error:', err.message);
  }

  // 3. Ambil daftar folder di dalam Root Cashback Folder
  let driveFolders: Array<{ id: string; name: string; webViewLink?: string }> = [];
  try {
    let pageToken: string | undefined = undefined;
    do {
      const res: any = await drive.files.list({
        q: `'${KPR_CONFIG.CASHBACK_ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'nextPageToken, files(id, name, webViewLink)',
        pageSize: 100,
        pageToken
      });
      if (res.data.files) {
        driveFolders.push(...res.data.files);
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  } catch (err: any) {
    console.error('[Cashback] Gagal mengakses root folder Cashback di Drive:', err.message);
  }

  // 4. Kumpulkan deals yang memiliki Cashback Amount > 0
  const rawCashbackDeals: any[] = [];
  for (let i = 1; i < akadRows.length; i++) {
    const r = akadRows[i];
    const customer = String(r[1] || '').trim();
    if (!customer) continue;

    const cbAmount = parseNumberClean(r[8]); // Col I: Cashback Amount to client (IDR)
    if (cbAmount <= 0) continue;

    const dbRow = i + 1;
    const tglAkad = String(r[4] || '').trim();
    const bank = String(r[5] || '').trim();
    const plafond = parseNumberClean(r[6]);
    const phone = String(r[2] || '').trim();
    const moCode = String(r[27] || '').trim();

    rawCashbackDeals.push({
      dbRow,
      customer,
      tglAkad,
      bank,
      plafond,
      cbAmount,
      phone,
      moCode
    });
  }

  // 5. Cek folder dan berkas pendukung di Drive untuk masing-masing transaksi
  const deals: CashbackDealItem[] = [];

  for (let idx = 0; idx < rawCashbackDeals.length; idx++) {
    const d = rawCashbackDeals[idx];
    const cNorm = cleanName(d.customer);
    const company = getCompanyByBank(d.bank);
    const entity = getEntityCodeByBank(d.bank) as 'NND' | 'WMI';

    // Cari folder nasabah di Drive
    let matchedFolder: { id: string; name: string; webViewLink?: string } | undefined;
    for (const f of driveFolders) {
      if (cleanName(f.name) === cNorm || cleanName(f.name).includes(cNorm) || cNorm.includes(cleanName(f.name))) {
        matchedFolder = f;
        break;
      }
    }

    let hasFolder = !!matchedFolder;
    let folderId = matchedFolder?.id;
    let folderUrl = matchedFolder ? (matchedFolder.webViewLink || `https://drive.google.com/drive/folders/${matchedFolder.id}`) : '';
    let hasMemo = false;
    let memoName = '';
    let memoUrl = '';
    let hasPr = false;
    let prUrl = '';
    let prFileId = '';

    if (folderId) {
      try {
        const fList = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink, shortcutDetails)'
        });
        const files = fList.data.files || [];
        for (const file of files) {
          const fn = (file.name || '').toLowerCase();
          if (fn.includes('memo') && (fn.includes('cashback') || fn.endsWith('.pdf'))) {
            hasMemo = true;
            memoName = file.name || '';
            const targetId = file.shortcutDetails?.targetId || file.id;
            memoUrl = file.webViewLink || `https://drive.google.com/file/d/${targetId}/view`;
          }
          if (fn.includes('pr request') || fn.includes('pr cashback') || fn.includes('payment requisition')) {
            hasPr = true;
            prFileId = file.id!;
            prUrl = file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
          }
        }
      } catch (err: any) {
        console.warn(`[Cashback] Gagal membaca isi folder ${d.customer}:`, err.message);
      }
    }

    const cbMeta = leadsCbMap[cNorm];
    const statusLeadsCashback = cbMeta?.progress || '';
    const syncStatus: 'SINKRON' | 'BELUM_ADA' = hasFolder && hasPr ? 'SINKRON' : 'BELUM_ADA';

    deals.push({
      row: idx + 1,
      dbRow: d.dbRow,
      customerName: d.customer,
      tglAkad: d.tglAkad,
      bank: d.bank,
      plafond: d.plafond,
      cashbackAmount: d.cbAmount,
      moCode: d.moCode,
      phone: d.phone,
      company,
      entity,
      hasFolder,
      folderId,
      folderUrl,
      hasMemo,
      memoName,
      memoUrl,
      hasPr,
      prUrl,
      prFileId,
      syncStatus,
      statusLeadsCashback
    });
  }

  return deals;
}

/**
 * Mengambil file Memo Cashback terbaru dari folder Master Memo Drive (diurutkan berdasarkan modifiedTime terbaru)
 * dengan fallback ke Memo Q4 2026 di KPR_CONFIG.
 */
async function resolveLatestMemoForEntity(
  drive: any,
  entity: 'NND' | 'WMI'
): Promise<{ id: string; name: string }> {
  const fallbackId = entity === 'NND' ? KPR_CONFIG.CASHBACK_MEMO_NND_ID : KPR_CONFIG.CASHBACK_MEMO_WMI_ID;
  const fallbackName = entity === 'NND' ? KPR_CONFIG.CASHBACK_MEMO_NND_NAME : KPR_CONFIG.CASHBACK_MEMO_WMI_NAME;

  try {
    const res = await drive.files.list({
      q: `'${KPR_CONFIG.CASHBACK_MEMO_FOLDER_ID}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 30
    });
    const files = res.data.files || [];
    const entityToken = entity.toLowerCase();
    const matched = files.find((f: any) => {
      const fn = String(f.name || '').toLowerCase();
      return fn.includes('memo') && fn.includes(entityToken);
    });
    if (matched?.id && matched?.name) {
      return { id: matched.id, name: matched.name };
    }
  } catch (err: any) {
    console.warn(`[Cashback] Gagal mengambil memo terbaru dari Drive untuk ${entity}:`, err.message);
  }

  return { id: fallbackId, name: fallbackName };
}

/**
 * Menjalankan pembuatan folder nasabah, shortcut memo NND/WMI, dan berkas PR Request Spreadsheet
 */
export async function processCashbackDealWorkflow(
  deal: CashbackDealItem
): Promise<{
  folderId: string;
  folderUrl: string;
  prUrl: string;
  memoAttached: boolean;
  isSuccess: boolean;
}> {
  const drive = await getDriveService();
  const sheets = await getSheetsService();

  const rootId = KPR_CONFIG.CASHBACK_ROOT_FOLDER_ID;
  const custNameClean = deal.customerName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();

  // 1. Dapatkan atau buat Folder Nasabah di bawah Root Cashback
  let folderId = deal.folderId || '';
  let folderUrl = deal.folderUrl || '';

  if (!folderId) {
    const existing = await findFolderInParent(rootId, deal.customerName);
    if (existing) {
      folderId = existing.id;
      folderUrl = `https://drive.google.com/drive/folders/${existing.id}`;
    } else {
      const created = await createFolderInParent(rootId, custNameClean);
      folderId = created.id;
      folderUrl = `https://drive.google.com/drive/folders/${created.id}`;
    }
  }

  // 2. Pasang Shortcut Memo Cashback Terbaru (NND vs WMI) secara dinamis dari folder Master Memo Drive
  let memoAttached = false;
  const latestMemo = await resolveLatestMemoForEntity(drive, deal.entity);
  const memoTargetId = latestMemo.id;
  const memoTargetName = latestMemo.name;

  try {
    const existingFiles = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, shortcutDetails)'
    });
    const files = existingFiles.data.files || [];
    const existingMemos = files.filter(f => (f.name || '').toLowerCase().includes('memo'));
    const hasLatestAlready = existingMemos.some(
      f => f.shortcutDetails?.targetId === memoTargetId || f.name === memoTargetName
    );
    const tglLower = String(deal.tglAkad || '').toLowerCase();
    const isQ4OrNewer = /\b(oct|okt|nov|dec|des)\b/.test(tglLower) || /202[7-9]/.test(tglLower);

    if (existingMemos.length > 0 && !hasLatestAlready && isQ4OrNewer) {
      // Hapus shortcut memo lama untuk transaksi Q4+ jika ada versi memo yang lebih baru
      for (const oldMemo of existingMemos) {
        if (oldMemo.mimeType === 'application/vnd.google-apps.shortcut' && oldMemo.id) {
          try {
            await drive.files.update({
              fileId: oldMemo.id,
              requestBody: { trashed: true }
            });
          } catch {}
        }
      }
    }

    if (existingMemos.length === 0 || (!hasLatestAlready && isQ4OrNewer)) {
      try {
        await drive.files.create({
          requestBody: {
            name: memoTargetName,
            mimeType: 'application/vnd.google-apps.shortcut',
            shortcutDetails: { targetId: memoTargetId },
            parents: [folderId]
          }
        });
        memoAttached = true;
      } catch (scErr: any) {
        // Fallback: copy file jika shortcut gagal
        await drive.files.copy({
          fileId: memoTargetId,
          requestBody: {
            name: memoTargetName,
            parents: [folderId]
          }
        });
        memoAttached = true;
      }
    } else {
      memoAttached = true;
    }
  } catch (memoErr: any) {
    console.warn(`[Cashback] Peringatan: Gagal memasang memo untuk ${deal.customerName}:`, memoErr.message);
  }

  // 3. Salin & Perbarui PR Request Spreadsheet
  let prUrl = deal.prUrl || '';
  let prFileId = deal.prFileId || '';

  const prTargetName = `PR Request - Cashback Leads a.n.  ${custNameClean}`;

  if (!prFileId) {
    try {
      const copyRes = await drive.files.copy({
        fileId: KPR_CONFIG.TEMPLATE_PR_ID,
        requestBody: {
          name: prTargetName,
          parents: [folderId]
        },
        fields: 'id, name, webViewLink'
      });
      prFileId = copyRes.data.id!;
      prUrl = copyRes.data.webViewLink || `https://docs.google.com/spreadsheets/d/${prFileId}/edit`;
    } catch (copyErr: any) {
      console.warn(`[Cashback] Gagal menyalin template PR untuk ${deal.customerName}:`, copyErr.message);
    }
  }

  if (prFileId) {
    try {
      const today = new Date();
      const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;

      const cellUpdates = [
        { range: "'PR Request'!G11", values: [[dateStr]] },
        { range: "'PR Request'!D12", values: [[deal.company]] },
        { range: "'PR Request'!D13", values: [['Fransisca Octarina']] },
        { range: "'PR Request'!D14", values: [['CEO Team']] },
        { range: "'PR Request'!D15", values: [[`Cashback Promo KPR Nasabah a.n. ${deal.customerName}`]] },
        { range: "'PR Request'!D17", values: [[deal.customerName]] },
        { range: "'PR Request'!D19", values: [[deal.bank]] },
        { range: "'PR Request'!D20", values: [['']] },
        { range: "'PR Request'!D21", values: [[deal.customerName]] },
        { range: "'PR Request'!D22", values: [[deal.cashbackAmount]] },
        {
          range: "'PR Request'!C25",
          values: [[`Mortgage - Customer Cashback\nPromo KPR Gebyar Rumah123 a.n. ${deal.customerName}`]]
        },
        { range: "'PR Request'!F25", values: [['Cost Mortgage - Customer Cashback']] },
        { range: "'PR Request'!G25", values: [['=D22']] },
        { range: "'PR Request'!G32", values: [['=G25']] },
        { range: "'PR Request'!D34", values: [[`=HYPERLINK("${folderUrl}", "${deal.customerName}")`]] },
        { range: "'PR Request'!B38", values: [[KPR_CONFIG.REQUESTER_NAME]] },
        { range: "'PR Request'!D38", values: [[KPR_CONFIG.APPROVER_BU_HEAD]] }
      ];

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: prFileId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: cellUpdates
        }
      });
    } catch (cellErr: any) {
      console.warn(`[Cashback] Gagal memperbarui nilai sel PR Request (${prFileId}):`, cellErr.message);
    }
  }

  // 4. Update tab 'Leads Cashback' di master database jika ada
  try {
    const cbRes = await sheets.spreadsheets.values.get({
      spreadsheetId: KPR_CONFIG.AKAD_SPREADSHEET_ID,
      range: "'Leads Cashback'!A1:J100"
    });
    const cbRows = cbRes.data.values || [];
    const normName = cleanName(deal.customerName);
    for (let i = 1; i < cbRows.length; i++) {
      if (cleanName(cbRows[i][0]) === normName) {
        const rowNum = i + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId: KPR_CONFIG.AKAD_SPREADSHEET_ID,
          range: `'Leads Cashback'!H${rowNum}:J${rowNum}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Process PR', cbRows[i][8] || '', `=HYPERLINK("${folderUrl}", "${deal.customerName}")`]
            ]
          }
        });
        break;
      }
    }
  } catch (err: any) {
    console.warn(`[Cashback] Gagal memperbarui baris Leads Cashback:`, err.message);
  }

  return {
    folderId,
    folderUrl,
    prUrl,
    memoAttached,
    isSuccess: !!folderId && !!prUrl
  };
}
