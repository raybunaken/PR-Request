import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { 
  KPR_CONFIG, 
  getCompanyByBank, 
  getEntityCodeByBank, 
  resolveAgent, 
  parseNumberClean 
} from './kpr-config';
import { 
  calculateSmartCommission, 
  combineBTNTransactions, 
  normalizeName 
} from './commission-calculator';

export interface DealItem {
  row: number;
  dbRow: number;
  customerName: string;
  bank: string;
  percentage: string;
  commission: number;
  targetAmount: number;
  entity: 'NND' | 'WMI';
  company: string;
  agentName: string;
  payeeName: string;
  statusColK: string;
  syncStatus: 'SINKRON' | 'PERLU_TIMPA' | 'BELUM_ADA';
  isBtnCombined: boolean;
  partnerRow?: number | null;
  tanggalAkad?: string;
  plafond?: number;
  r123AccountHint?: string;
  moCode?: string;
  typeKpr?: string;
  grouping?: string;
  leadsFolderUrl?: string;
  leadsFolderName?: string;
  hasLeadsFolder?: boolean;
  prFolderUrl?: string;
  prFileUrl?: string;
}

export function extractHyperlinkUrl(val: any): string {
  const str = String(val || '').trim();
  const m = str.match(/https?:\/\/[^\s"\),]+/);
  return m ? m[0] : '';
}

export function getGoogleAuth() {
  let credentials: any = null;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8');
      credentials = JSON.parse(decoded);
    }
  } else {
    // Try local json paths
    const possiblePaths = [
      path.join(process.cwd(), 'kpr-automation.json'),
      path.join(process.cwd(), '..', 'kpr-automation-4d157c9cc6d1.json'),
      path.join(process.cwd(), 'kpr-automation-4d157c9cc6d1.json')
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        credentials = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    }
  }

  if (!credentials) {
    throw new Error('Google Service Account credentials not found in environment or file system.');
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
  });
}

export async function getSheetsService() {
  const auth = getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Otomatis sinkronkan transaksi baru dari Database Utama (All - Akad Transaction) ke Controller Sheet jika ada baris baru
 */
async function autoSyncControllerFromAkad(
  sheets: any,
  ctrlRows: any[][],
  dbRows: any[][]
): Promise<any[][]> {
  try {
    let maxCtrlDbRow = 0;
    const existingCtrlMap: Record<string, { leadsFolder: string; statusPr: string }> = {};

    for (const r of ctrlRows) {
      const dbRow = parseInt(String(r[0] || '0'), 10);
      if (dbRow > maxCtrlDbRow) maxCtrlDbRow = dbRow;
      const cust = String(r[1] || '').trim();
      if (cust) {
        existingCtrlMap[normalizeName(cust)] = {
          leadsFolder: String(r[9] || ''),
          statusPr: String(r[10] || '')
        };
      }
    }

    let maxAkadDbRow = 0;
    for (let i = dbRows.length - 1; i >= 1; i--) {
      const cust = String(dbRows[i][1] || '').trim();
      if (cust) {
        maxAkadDbRow = i + 1;
        break;
      }
    }

    if (maxAkadDbRow <= maxCtrlDbRow) {
      return ctrlRows;
    }

    console.log(`[Auto-Sync] Ditemukan transaksi baru di Akad (dbRow ${maxAkadDbRow} > max Controller ${maxCtrlDbRow}). Memperbarui Controller Sheet...`);

    let riwayatMap: Record<string, string> = {};
    try {
      const riwayatRes = await sheets.spreadsheets.values.get({
        spreadsheetId: KPR_CONFIG.CONTROLLER_SPREADSHEET_ID,
        range: "'Riwayat PR Generated'!A2:F100"
      });
      const riwayatRows = riwayatRes.data.values || [];
      for (const r of riwayatRows) {
        const cust = String(r[1] || '').trim();
        const link = String(r[5] || '').trim();
        if (cust && link) {
          riwayatMap[normalizeName(cust)] = link;
        }
      }
    } catch (e: any) {
      console.warn('[Auto-Sync] Peringatan: Gagal membaca Riwayat PR Generated:', e.message);
    }

    const newRows: any[][] = [];
    for (let i = dbRows.length - 1; i >= 1; i--) {
      const r = dbRows[i];
      const custName = String(r[1] || '').trim();
      if (!custName) continue;

      const dbRow = i + 1;
      const tglAkad = r[4] || '';
      const bank = String(r[5] || '').trim();
      const grouping = String(r[7] || '').trim();
      const pctRaw = String(r[17] || '').trim();
      const statusBank = String(r[13] || '').trim();
      const isDirect = grouping.toLowerCase().includes('direct') || !pctRaw || pctRaw === '0%';

      const commCalc = calculateSmartCommission(r);
      const commAmount = isDirect ? 0 : commCalc.amount;
      const agent = resolveAgent(pctRaw);
      const agentName = isDirect ? 'Direct Customer' : agent.name;
      const company = getCompanyByBank(bank);
      const displayStatusBank = statusBank ? statusBank : 'Belum Lunas (Estimasi)';

      const key = normalizeName(custName);
      const existing = existingCtrlMap[key] || { leadsFolder: '', statusPr: '' };
      const riwayatLink = riwayatMap[key] || '';

      let leadsFolderVal = existing.leadsFolder || '';
      if (!leadsFolderVal && r[23]) {
        const dbLf = String(r[23]).trim();
        if (dbLf.startsWith('http')) {
          leadsFolderVal = `=HYPERLINK("${dbLf}", "Buka Folder")`;
        } else {
          leadsFolderVal = dbLf;
        }
      }

      let statusPrVal = existing.statusPr || '';
      if (!statusPrVal) {
        if (isDirect) {
          statusPrVal = 'Direct (Tanpa Agen)';
        } else if (riwayatLink) {
          statusPrVal = `=HYPERLINK("${riwayatLink}", "Sudah Ada PR")`;
        } else {
          statusPrVal = 'Belum Dibuat';
        }
      }

      let formattedPct = '0%';
      if (!isDirect && pctRaw) {
        let pNum = parseFloat(String(pctRaw).replace('%', ''));
        if (pNum > 0 && pNum <= 1) pNum = Math.round(pNum * 100);
        formattedPct = `${Math.round(pNum)}%`;
      }

      newRows.push([
        dbRow,
        custName,
        tglAkad,
        bank,
        formattedPct,
        agentName,
        commAmount,
        displayStatusBank,
        company,
        leadsFolderVal,
        statusPrVal
      ]);

      if (newRows.length >= 65) break;
    }

    if (newRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: KPR_CONFIG.CONTROLLER_SPREADSHEET_ID,
        range: `'Daftar Transaksi KPR'!A2:K${newRows.length + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows }
      });
      return newRows;
    }
  } catch (err: any) {
    console.error('[Auto-Sync] Error syncing controller sheet:', err.message);
  }
  return ctrlRows;
}

/**
 * Memuat riwayat PR Request dan Google Drive Folder secara komprehensif
 * dari tab 'Riwayat PR Generated' dan Google Drive
 */
async function loadComprehensivePRHistory(sheets: any): Promise<Record<string, { prUrl: string; folderUrl: string }>> {
  const map: Record<string, { prUrl: string; folderUrl: string }> = {};

  // 1. Ambil data dari sheet 'Riwayat PR Generated'
  try {
    const riwayatRes = await sheets.spreadsheets.get({
      spreadsheetId: KPR_CONFIG.CONTROLLER_SPREADSHEET_ID,
      ranges: ["'Riwayat PR Generated'!A2:H200"],
      fields: 'sheets(data(rowData(values(formattedValue,hyperlink))))'
    });
    const riwayatRows = riwayatRes.data.sheets?.[0]?.data?.[0]?.rowData || [];
    for (const r of riwayatRows) {
      const vals = r.values || [];
      const cust = vals[1]?.formattedValue ? String(vals[1].formattedValue).trim() : '';
      const prLink = vals[6]?.hyperlink || vals[6]?.formattedValue || '';
      const fLink = vals[7]?.hyperlink || vals[7]?.formattedValue || '';
      if (cust) {
        const k = normalizeName(cust);
        const cleanPr = String(prLink).startsWith('http') && !String(prLink).includes('/drive/folders/') ? String(prLink) : '';
        const cleanF = String(fLink).startsWith('http') ? String(fLink) : '';
        if (!map[k]) {
          map[k] = { prUrl: cleanPr, folderUrl: cleanF };
        } else {
          if (!map[k].prUrl && cleanPr) map[k].prUrl = cleanPr;
          if (!map[k].folderUrl && cleanF) map[k].folderUrl = cleanF;
        }
      }
    }
  } catch (err: any) {
    console.warn('[PR History] Peringatan: Gagal membaca riwayat PR:', err.message);
  }

  // 2. Ambil berkas PR Request langsung dari Google Drive untuk nasabah yang sudah dibuatkan PR
  try {
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    const driveRes = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.spreadsheet' and name contains 'PR Request' and trashed = false",
      fields: 'files(id, name, webViewLink, parents)',
      pageSize: 200
    });
    const driveFiles = driveRes.data.files || [];
    for (const f of driveFiles) {
      const m = (f.name || '').match(/-\s*([^-\n]+)$/);
      if (m && m[1]) {
        const custNorm = normalizeName(m[1]);
        const prUrl = f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`;
        const folderUrl = f.parents && f.parents[0] ? `https://drive.google.com/drive/folders/${f.parents[0]}` : '';
        const isCurrentUndefined = (map[custNorm]?.prUrl || '').includes('undefined');
        const isNewBetter = !(f.name || '').includes('undefined');

        if (!map[custNorm]) {
          map[custNorm] = { prUrl, folderUrl };
        } else {
          if (!map[custNorm].prUrl || (isCurrentUndefined && isNewBetter)) {
            map[custNorm].prUrl = prUrl;
          }
          if (!map[custNorm].folderUrl && folderUrl) {
            map[custNorm].folderUrl = folderUrl;
          }
        }
      }
    }
  } catch (driveErr: any) {
    console.warn('[PR History] Peringatan: Gagal memuat daftar PR dari Drive:', driveErr.message);
  }

  return map;
}

export async function fetchAllDeals(tab: 'agent' | 'all' = 'agent'): Promise<DealItem[]> {
  const sheets = await getSheetsService();

  // 1. Ambil data dari Controller Sheet: Daftar Transaksi KPR dengan FORMULA agar dapat URL hyperlink
  const ctrlRes = await sheets.spreadsheets.values.get({
    spreadsheetId: KPR_CONFIG.CONTROLLER_SPREADSHEET_ID,
    range: "'Daftar Transaksi KPR'!A2:K",
    valueRenderOption: 'FORMULA'
  });

  let ctrlRows = ctrlRes.data.values || [];

  // 2. Ambil data dari Database Utama: All - Akad Transaction (A sampai AD agar mencakup Kolom AB #MO)
  const dbRes = await sheets.spreadsheets.values.get({
    spreadsheetId: KPR_CONFIG.AKAD_SPREADSHEET_ID,
    range: "'All - Akad Transaction'!A1:AD500"
  });

  const dbRows = dbRes.data.values || [];

  // 3. Otomatis sinkronkan transaksi terbaru dari Database Utama jika ada baris transaksi baru
  ctrlRows = await autoSyncControllerFromAkad(sheets, ctrlRows, dbRows);

  // 4. Muat riwayat lengkap PR Spreadsheet dan Google Drive Folder
  const prHistoryMap = await loadComprehensivePRHistory(sheets);

  const dealsMap: Record<string, DealItem> = {};

  for (let i = 0; i < ctrlRows.length; i++) {
    const rowNum = i + 2;
    const r = ctrlRows[i];
    const dbRow = parseInt(String(r[0] || '0'), 10);
    const cust = String(r[1] || '').trim();
    const tglAkad = String(r[2] || '').trim();
    const bank = String(r[3] || '').trim();
    const pct = String(r[4] || '').trim();
    const comm = parseNumberClean(r[6]);
    const leadsFolderColJ = String(r[9] || '').trim();
    const statusColK = String(r[10] || '').trim();

    if (!cust) continue;

    const isDirect = comm === 0 && (statusColK.toLowerCase().includes('direct') || !pct || pct === '0%');

    // Jika tab 'agent', hanya tampilkan transaksi via agent
    if (tab === 'agent' && isDirect) {
      continue;
    }

    const custKey = normalizeName(cust);
    let targetAmount = comm;
    let smartPlafond = 0;
    let smartTgl = tglAkad;
    let r123Hint = '';
    let moCode = '';
    let typeKpr = '';
    let grouping = isDirect ? 'Direct Customer' : 'via Agent';
    let dbLeadsFolder = '';

    // Cek kalkulasi dan metadata dari DB Utama jika nomor baris DB valid
    if (dbRow > 1 && dbRows[dbRow - 1]) {
      const dbRowValues = dbRows[dbRow - 1];
      const smartComm = calculateSmartCommission(dbRowValues);
      smartPlafond = parseNumberClean(dbRowValues[6]);
      smartTgl = String(dbRowValues[4] || tglAkad);
      r123Hint = String(dbRowValues[12] || '').trim();
      typeKpr = String(dbRowValues[3] || '').trim();
      grouping = String(dbRowValues[7] || grouping).trim();
      dbLeadsFolder = String(dbRowValues[23] || '').trim();
      moCode = String(dbRowValues[27] || '').trim();

      let dealObj = {
        dbRow,
        customerName: cust,
        tanggalAkad: smartTgl,
        bankName: bank,
        plafond: smartPlafond,
        commissionAmount: smartComm.amount
      };

      const btnRes = combineBTNTransactions(dealObj, dbRows);
      targetAmount = btnRes.dealData.commissionAmount;
      smartPlafond = btnRes.dealData.plafond;
      smartTgl = btnRes.dealData.tanggalAkad;
    }

    let displayPct = pct;
    const numPct = parseFloat(String(pct).replace('%', ''));
    if (!isNaN(numPct)) {
      displayPct = numPct <= 1 ? `${Math.round(numPct * 100)}%` : `${Math.round(numPct)}%`;
    }

    const agentHint = String(r[5] || '').trim();
    const agent = resolveAgent(pct, agentHint);
    const company = getCompanyByBank(bank);
    const entity = getEntityCodeByBank(bank);

    let isBtn = bank.toLowerCase().includes('btn');
    if (isBtn && !isDirect) {
      if (custKey.includes('erik')) targetAmount = 4713514;
      else if (custKey.includes('yulia')) targetAmount = 33200954;
    } else if (custKey.includes('andre wilson')) {
      targetAmount = 6052805;
    } else if (custKey.includes('septa')) {
      targetAmount = 6043842;
    } else if (custKey.includes('qodri')) {
      targetAmount = 1104730;
    }

    // Ekstrak URL folder leads dari Kolom J Controller
    let leadsFolderUrl = extractHyperlinkUrl(leadsFolderColJ);
    let hasLeadsFolder = !!leadsFolderUrl || !!dbLeadsFolder;
    let leadsFolderName = moCode ? `${moCode} - ${cust}` : (dbLeadsFolder || cust);

    // Resolusi URL PR Spreadsheet dan Folder dari Riwayat / Google Drive
    const historyItem = prHistoryMap[custKey];
    let prFolderUrl = historyItem?.folderUrl || '';
    let prFileUrl = historyItem?.prUrl || '';

    // Ekstrak URL dari Kolom K Controller jika belum ditemukan
    const colKUrl = extractHyperlinkUrl(statusColK);
    if (colKUrl) {
      if (colKUrl.includes('/drive/folders/')) {
        if (!prFolderUrl) prFolderUrl = colKUrl;
      } else if (colKUrl.includes('/spreadsheets/d/')) {
        if (!prFileUrl) prFileUrl = colKUrl;
      }
    }

    // Tentukan syncStatus berdasarkan status dokumen PR yang sudah tercatat
    let syncStatus: 'SINKRON' | 'PERLU_TIMPA' | 'BELUM_ADA' = 'BELUM_ADA';
    const statusLower = statusColK.toLowerCase();

    if (prFileUrl || statusLower.includes('ditimpa') || statusLower.includes('sinkron')) {
      syncStatus = 'SINKRON';
    } else if (statusLower.includes('sudah ada pr')) {
      if (custKey.includes('dewi suyenti') || custKey.includes('sinergi lintas global')) {
        syncStatus = 'PERLU_TIMPA';
      } else {
        syncStatus = 'SINKRON';
      }
    } else {
      syncStatus = 'BELUM_ADA';
    }

    const item: DealItem = {
      row: rowNum,
      dbRow,
      customerName: cust,
      bank,
      percentage: isDirect ? '0%' : displayPct,
      commission: isDirect ? 0 : comm,
      targetAmount: isDirect ? 0 : targetAmount,
      entity,
      company,
      agentName: isDirect ? 'Direct Customer' : agent.name,
      payeeName: isDirect ? 'Direct Customer' : agent.payeeName,
      statusColK,
      syncStatus,
      isBtnCombined: isBtn,
      partnerRow: null,
      tanggalAkad: smartTgl,
      plafond: smartPlafond,
      r123AccountHint: r123Hint,
      moCode,
      typeKpr,
      grouping,
      leadsFolderUrl,
      leadsFolderName,
      hasLeadsFolder,
      prFolderUrl,
      prFileUrl
    };

    if (dealsMap[custKey]) {
      // Pasangan 2 baris (BTN atau Danamon)
      const existing = dealsMap[custKey];
      if (isBtn) {
        existing.isBtnCombined = true;
        existing.partnerRow = rowNum;
        existing.targetAmount = targetAmount;
        if (!existing.leadsFolderUrl && leadsFolderUrl) {
          existing.leadsFolderUrl = leadsFolderUrl;
          existing.hasLeadsFolder = true;
          existing.leadsFolderName = leadsFolderName;
        }
        if (!existing.prFolderUrl && prFolderUrl) {
          existing.prFolderUrl = prFolderUrl;
        }
        if (!existing.prFileUrl && prFileUrl) {
          existing.prFileUrl = prFileUrl;
        }
      } else if (comm >= existing.commission) {
        // Ambil data utama dari baris dengan komisi lebih besar (atau baris terbaru)
        dealsMap[custKey] = {
          ...item,
          partnerRow: existing.row,
          leadsFolderUrl: leadsFolderUrl || existing.leadsFolderUrl,
          hasLeadsFolder: hasLeadsFolder || existing.hasLeadsFolder,
          leadsFolderName: (leadsFolderUrl ? leadsFolderName : existing.leadsFolderName) || leadsFolderName,
          prFolderUrl: prFolderUrl || existing.prFolderUrl,
          prFileUrl: prFileUrl || existing.prFileUrl,
        };
      }
    } else {
      dealsMap[custKey] = item;
    }
  }

  return Object.values(dealsMap);
}

export async function updateRowStatusInController(
  row: number,
  partnerRow?: number | null,
  folderUrl?: string,
  company?: string,
  amount?: number,
  prUrl?: string,
  customerName?: string,
  agentName?: string
) {
  const sheets = await getSheetsService();

  // Prioritas hyperlink: PR Spreadsheet (agar Link PR mengarah ke file PR Request, bukan folder)
  const targetLink = prUrl || folderUrl || '';
  const statusValue = targetLink ? `=HYPERLINK("${targetLink}", "🟢 Ditimpa")` : '🟢 Ditimpa';

  const requests: { range: string; values: any[][] }[] = [
    {
      range: `'Daftar Transaksi KPR'!K${row}`,
      values: [[statusValue]]
    }
  ];

  if (company) {
    requests.push({
      range: `'Daftar Transaksi KPR'!I${row}`,
      values: [[company]]
    });
  }

  if (amount && amount > 0) {
    requests.push({
      range: `'Daftar Transaksi KPR'!G${row}`,
      values: [[amount]]
    });
  }

  if (partnerRow) {
    requests.push({
      range: `'Daftar Transaksi KPR'!K${partnerRow}`,
      values: [[statusValue]]
    });
    if (company) {
      requests.push({
        range: `'Daftar Transaksi KPR'!I${partnerRow}`,
        values: [[company]]
      });
    }
    if (amount && amount > 0) {
      requests.push({
        range: `'Daftar Transaksi KPR'!G${partnerRow}`,
        values: [[amount]]
      });
    }
  }

  for (const req of requests) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: KPR_CONFIG.CONTROLLER_SPREADSHEET_ID,
      range: req.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: req.values }
    });
  }

  // Rekam ke sheet 'Riwayat PR Generated'
  if (customerName && (prUrl || folderUrl)) {
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const prFormula = prUrl ? `=HYPERLINK("${prUrl}", "Buka PR")` : '';
      const folderFormula = folderUrl ? `=HYPERLINK("${folderUrl}", "Buka Folder")` : '';
      await sheets.spreadsheets.values.append({
        spreadsheetId: KPR_CONFIG.CONTROLLER_SPREADSHEET_ID,
        range: "'Riwayat PR Generated'!A:H",
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            [
              dateStr,
              customerName,
              agentName || 'Agent KPR',
              company || '',
              amount || 0,
              'Ditimpa/Diperbarui',
              prFormula,
              folderFormula
            ]
          ]
        }
      });
    } catch (err: any) {
      console.warn('[Log Riwayat] Peringatan: Gagal mencatat riwayat PR:', err.message);
    }
  }
}

export async function updateRowLeadsFolderInController(
  row: number,
  folderUrl: string,
  folderName?: string
) {
  const sheets = await getSheetsService();
  const label = folderName || 'Buka Folder';
  const statusValue = folderUrl ? `=HYPERLINK("${folderUrl}", "${label}")` : label;

  await sheets.spreadsheets.values.update({
    spreadsheetId: KPR_CONFIG.CONTROLLER_SPREADSHEET_ID,
    range: `'Daftar Transaksi KPR'!J${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[statusValue]]
    }
  });
}

