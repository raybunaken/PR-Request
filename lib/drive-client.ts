import { google } from 'googleapis';
import { Readable } from 'stream';
import { KPR_CONFIG, resolveAgent } from './kpr-config';
import { getGoogleAuth, getSheetsService, DealItem } from './sheets-client';

export async function getDriveService() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Memeriksa apakah Service Account memiliki akses ke folder root Google Drive
 */
export async function isDriveFolderAccessible(folderId: string = KPR_CONFIG.REFERRAL_FEE_AGENT_FOLDER_ID): Promise<boolean> {
  try {
    const drive = await getDriveService();
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, capabilities'
    });
    return !!res.data.id;
  } catch {
    return false;
  }
}

/**
 * Mencari folder di dalam folder induk berdasarkan nama (case-insensitive)
 */
export async function findFolderInParent(
  parentId: string,
  namePart: string
): Promise<{ id: string; name: string } | null> {
  const drive = await getDriveService();
  const clean = namePart.toLowerCase().trim();

  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 100
  });

  const files = res.data.files || [];
  for (const f of files) {
    if (f.name && f.name.toLowerCase().includes(clean)) {
      return { id: f.id!, name: f.name };
    }
  }
  return null;
}

/**
 * Membuat folder baru di dalam folder induk
 */
export async function createFolderInParent(
  parentId: string,
  folderName: string
): Promise<{ id: string; name: string }> {
  const drive = await getDriveService();
  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id, name'
  });

  return { id: res.data.id!, name: res.data.name! };
}

/**
 * Mendapatkan atau membuat folder Agen
 */
export async function getOrCreateAgentFolder(agentName: string): Promise<string> {
  const rootId = KPR_CONFIG.REFERRAL_FEE_AGENT_FOLDER_ID;
  const firstName = agentName.split(' ')[0].toLowerCase();
  const found = await findFolderInParent(rootId, firstName);
  if (found) return found.id;

  const created = await createFolderInParent(rootId, agentName);
  return created.id;
}

/**
 * Mendapatkan atau membuat folder Nasabah di bawah folder Agen
 */
export async function getOrCreateLeadFolder(
  agentFolderId: string,
  customerName: string
): Promise<{ id: string; url: string }> {
  const found = await findFolderInParent(agentFolderId, customerName);
  if (found) {
    return {
      id: found.id,
      url: `https://drive.google.com/drive/folders/${found.id}`
    };
  }

  const created = await createFolderInParent(agentFolderId, customerName);
  return {
    id: created.id,
    url: `https://drive.google.com/drive/folders/${created.id}`
  };
}

/**
 * Menyalin atau memperbarui Google Spreadsheet PR Request di dalam folder nasabah
 */
export async function syncPRSpreadsheetInDrive(
  deal: DealItem,
  leadFolderId: string,
  leadFolderUrl: string
): Promise<{ fileId: string; prUrl: string; isUpdated: boolean }> {
  const drive = await getDriveService();
  const sheets = await getSheetsService();
  const agent = resolveAgent(deal.percentage);

  // Cari apakah berkas PR sudah ada di folder nasabah
  const cleanCust = deal.customerName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const res = await drive.files.list({
    q: `'${leadFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, shortcutDetails)'
  });

  const files = res.data.files || [];
  let prFileId = '';
  let prUrl = '';
  let isUpdated = false;

  // 1. Cari kandidat file PR Request yang sesuai nama nasabah
  const candidates = files.filter(
    f =>
      f.name &&
      f.name.toLowerCase().includes('pr request') &&
      f.name.toLowerCase().includes(cleanCust.toLowerCase())
  );

  // 2. Loop dan verifikasi apakah candidate bisa diakses dengan Google Sheets API
  for (const f of candidates) {
    let candidateId = f.id;
    if (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails?.targetId) {
      candidateId = f.shortcutDetails.targetId;
    }
    if (!candidateId) continue;

    try {
      await sheets.spreadsheets.get({ spreadsheetId: candidateId, fields: 'spreadsheetId' });
      prFileId = candidateId;
      prUrl = f.webViewLink || `https://docs.google.com/spreadsheets/d/${candidateId}/edit`;
      isUpdated = true;
      break;
    } catch {
      console.warn(`File PR kandidat ${f.name} (id: ${candidateId}) tidak dapat diakses Sheets API`);
    }
  }

  // 3. Jika belum ada file PR yang valid & dapat diakses, salin dari template PR
  if (!prFileId) {
    const targetFileName = `PR Request - Referral Fee Agent a.n. ${deal.agentName} - ${cleanCust}`;
    try {
      const copyRes = await drive.files.copy({
        fileId: KPR_CONFIG.TEMPLATE_PR_ID,
        requestBody: {
          name: targetFileName,
          parents: [leadFolderId]
        },
        fields: 'id, name, webViewLink'
      });

      prFileId = copyRes.data.id!;
      prUrl = copyRes.data.webViewLink || `https://docs.google.com/spreadsheets/d/${prFileId}/edit`;
    } catch (err: any) {
      console.warn(`Gagal menyalin template PR (quota atau izin): ${err.message}`);
    }
  }

  // 4. Perbarui sel-sel data PR jika file ID valid
  if (prFileId) {
    try {
      const today = new Date();
      const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;

      const cellUpdates = [
        { range: "'PR Request'!G11", values: [[dateStr]] },
        { range: "'PR Request'!D12", values: [[deal.company]] },
        { range: "'PR Request'!D13", values: [['Fransisca Octarina']] },
        { range: "'PR Request'!D14", values: [['CEO Team']] },
        { range: "'PR Request'!D15", values: [[`Referral Fee Agent ${deal.payeeName}`]] },
        { range: "'PR Request'!D17", values: [[deal.payeeName]] },
        { range: "'PR Request'!D19", values: [[agent.bankName]] },
        { range: "'PR Request'!D20", values: [[agent.accountNumber]] },
        { range: "'PR Request'!D21", values: [[agent.accountName]] },
        { range: "'PR Request'!D22", values: [[deal.targetAmount]] },
        {
          range: "'PR Request'!C25",
          values: [[`Mortgage - Agent transaction\nCommission sharing a.n. ${deal.customerName}`]]
        },
        { range: "'PR Request'!F25", values: [['Cost Mortgage - Agent Transaction']] },
        { range: "'PR Request'!G25", values: [['=D22']] },
        { range: "'PR Request'!G32", values: [['=G25']] },
        { range: "'PR Request'!D34", values: [[`=HYPERLINK("${leadFolderUrl}", "${deal.customerName}")`]] },
        { range: "'PR Request'!B38", values: [['Fransisca Octarina']] },
        { range: "'PR Request'!D38", values: [['Cheung Yik']] }
      ];

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: prFileId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: cellUpdates
        }
      });
    } catch (err: any) {
      console.warn(`Peringatan: Gagal memperbarui nilai sel PR Request (${prFileId}):`, err.message);
    }
  }

  return { fileId: prFileId, prUrl, isUpdated };
}

/**
 * Mengunggah Agreement PDF (4 Halaman Utuh, 2 Bagian Lampiran) ke folder nasabah di Drive
 */
export async function uploadAgreementPdfToDrive(
  deal: DealItem,
  pdfBuffer: Buffer,
  leadFolderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = await getDriveService();
  const cleanCust = deal.customerName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const targetFileName = `Agreement Pembagian Komisi Agent - ${deal.agentName} - ${cleanCust}.pdf`;

  // Cari berkas agreement di dalam folder nasabah
  const res = await drive.files.list({
    q: `'${leadFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, webViewLink)'
  });

  const files = res.data.files || [];
  const existingAgreements = files.filter(
    f => f.name && f.name.toLowerCase().includes('agreement')
  );

  // Jika file sudah ada, UPDATE file secara in-place (mempertahankan quota pemilik asli)
  if (existingAgreements.length > 0) {
    const targetFile = existingAgreements[0];
    try {
      const updateRes = await drive.files.update({
        fileId: targetFile.id!,
        requestBody: {
          name: targetFileName
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from(pdfBuffer)
        },
        fields: 'id, name, webViewLink'
      });

      // Jika ada duplikat berlebih, bersihkan duplikatnya
      for (let i = 1; i < existingAgreements.length; i++) {
        try {
          await drive.files.update({
            fileId: existingAgreements[i].id!,
            requestBody: { trashed: true }
          });
        } catch {}
      }

      return {
        fileId: updateRes.data.id!,
        webViewLink: updateRes.data.webViewLink || `https://drive.google.com/file/d/${updateRes.data.id}/view`
      };
    } catch (err: any) {
      console.warn(`Peringatan: Gagal memperbarui file agreement lama (${targetFile.id}):`, err.message);
    }
  }

  // Jika belum ada berkas agreement sebelumnya, buat file baru
  try {
    const uploadRes = await drive.files.create({
      requestBody: {
        name: targetFileName,
        parents: [leadFolderId]
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(pdfBuffer)
      },
      fields: 'id, name, webViewLink'
    });

    return {
      fileId: uploadRes.data.id!,
      webViewLink: uploadRes.data.webViewLink || `https://drive.google.com/file/d/${uploadRes.data.id}/view`
    };
  } catch (err: any) {
    console.warn(`Peringatan: Gagal mengunggah PDF baru karena quota service account:`, err.message);
    return {
      fileId: '',
      webViewLink: ''
    };
  }
}

/**
 * Otomatis memasang shortcut berkas dokumen agen (No Rekening, NPWP, KTP) ke folder nasabah
 */
export async function attachAgentDocShortcuts(
  agentFolderId: string,
  leadFolderId: string
): Promise<number> {
  const drive = await getDriveService();
  try {
    const existingRes = await drive.files.list({
      q: `'${leadFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, shortcutDetails)',
      pageSize: 50
    });
    const existingFiles = existingRes.data.files || [];
    const existingTargetIds = new Set<string>();
    const existingNames = new Set<string>();

    for (const f of existingFiles) {
      if (f.name) existingNames.add(f.name.toLowerCase().trim());
      if (f.shortcutDetails?.targetId) {
        existingTargetIds.add(f.shortcutDetails.targetId);
      }
    }

    const agentRes = await drive.files.list({
      q: `'${agentFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: 'files(id, name, mimeType)',
      pageSize: 30
    });
    const agentDocs = agentRes.data.files || [];

    let count = 0;
    for (const doc of agentDocs) {
      if (!doc.name || !doc.id) continue;
      const clean = doc.name.toLowerCase().trim();
      if (clean.includes('pr request') || clean.includes('agreement') || clean.includes('perjanjian')) {
        continue;
      }
      if (existingTargetIds.has(doc.id) || existingNames.has(clean)) {
        continue;
      }

      try {
        await drive.files.create({
          requestBody: {
            name: doc.name,
            mimeType: 'application/vnd.google-apps.shortcut',
            shortcutDetails: { targetId: doc.id },
            parents: [leadFolderId]
          }
        });
        count++;
      } catch (err: any) {
        console.warn(`Gagal membuat shortcut dokumen agen ${doc.name}:`, err.message);
      }
    }
    return count;
  } catch (err: any) {
    console.warn('Gagal memproses shortcut dokumen agen:', err.message);
    return 0;
  }
}

/**
 * Otomatis mencari & memasang shortcut berkas PKS Bank ke folder nasabah
 */
export async function attachBankPKSShortcut(
  bankName: string,
  leadFolderId: string
): Promise<boolean> {
  const drive = await getDriveService();
  try {
    const rawBankClean = (bankName || '').toLowerCase().trim();
    const bankKeywords = [
      'danamon', 'uob', 'maybank', 'permata', 'ina',
      'mandiri', 'bsi', 'cimb', 'muamalat', 'bukopin',
      'ringkas', 'ganesha', 'bca', 'btn', 'bri', 'bni', 'hana'
    ];
    let matchedKeyword = '';
    for (const kw of bankKeywords) {
      if (rawBankClean.includes(kw)) {
        matchedKeyword = kw;
        break;
      }
    }
    if (!matchedKeyword) matchedKeyword = rawBankClean.split(' ')[0] || '';

    // Cek apakah shortcut/file PKS sudah ada di folder nasabah
    const existing = await drive.files.list({
      q: `'${leadFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 30
    });
    const hasPks = (existing.data.files || []).some(
      f => f.name && f.name.toLowerCase().includes('pks')
    );
    if (hasPks) return true;

    // Cari PKS file untuk bank ini di Google Drive
    const searchRes = await drive.files.list({
      q: `name contains 'PKS' and trashed = false`,
      fields: 'files(id, name, mimeType, shortcutDetails)',
      pageSize: 60
    });

    const candidate = (searchRes.data.files || []).find(
      f => f.name && f.name.toLowerCase().includes(matchedKeyword)
    );

    if (candidate && candidate.id) {
      const targetId = candidate.shortcutDetails?.targetId || candidate.id;
      await drive.files.create({
        requestBody: {
          name: candidate.name,
          mimeType: 'application/vnd.google-apps.shortcut',
          shortcutDetails: { targetId },
          parents: [leadFolderId]
        }
      });
      return true;
    }
  } catch (err: any) {
    console.warn(`Gagal memasang shortcut PKS bank ${bankName}:`, err.message);
  }
  return false;
}

/**
 * Menjalankan seluruh alur transaksi ke Google Drive (persis flow Spreadsheet)
 */
export async function processDealDriveWorkflow(
  deal: DealItem,
  agreementPdfBuffer: Buffer
): Promise<{ prUrl: string; folderUrl: string; agreementUrl: string }> {
  const agentFolderId = await getOrCreateAgentFolder(deal.agentName);
  const leadFolder = await getOrCreateLeadFolder(agentFolderId, deal.customerName);

  // 1. Pasang shortcut dokumen agen (No Rekening, NPWP, KTP) ke folder nasabah
  await attachAgentDocShortcuts(agentFolderId, leadFolder.id);

  // 2. Pasang shortcut berkas PKS Bank ke folder nasabah
  await attachBankPKSShortcut(deal.bank, leadFolder.id);

  // 3. Salin/perbarui berkas PR Request spreadsheet di folder nasabah
  const prResult = await syncPRSpreadsheetInDrive(deal, leadFolder.id, leadFolder.url);

  // 4. Unggah berkas Agreement Pembagian Komisi Agent PDF 4 Halaman Utuh
  const agreementResult = await uploadAgreementPdfToDrive(deal, agreementPdfBuffer, leadFolder.id);

  return {
    prUrl: prResult.prUrl,
    folderUrl: leadFolder.url,
    agreementUrl: agreementResult.webViewLink
  };
}

/**
 * Mendapatkan atau membuat Folder Leads Finance di bawah folder "Leads Akad Automation"
 * Format nama folder: "[#MO] - [Nama Nasabah]" atau "[Nama Nasabah]"
 */
export async function getOrCreateFinanceLeadFolder(
  moCode: string,
  customerName: string
): Promise<{ id: string; name: string; url: string; isNew: boolean }> {
  const rootId = KPR_CONFIG.FINANCE_LEADS_ROOT_FOLDER_ID;
  const cleanCust = customerName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const targetFolderName = (moCode ? `${moCode} - ` : '') + cleanCust;

  // Cek apakah sudah ada (cari berdasarkan nama nasabah atau kode MO)
  const searchPart = moCode ? moCode.trim() : cleanCust;
  const found = await findFolderInParent(rootId, searchPart);
  if (found) {
    return {
      id: found.id,
      name: found.name,
      url: `https://drive.google.com/drive/folders/${found.id}`,
      isNew: false
    };
  }

  // Buat baru jika belum ada
  const created = await createFolderInParent(rootId, targetFolderName);
  return {
    id: created.id,
    name: created.name,
    url: `https://drive.google.com/drive/folders/${created.id}`,
    isNew: true
  };
}

/**
 * Memeriksa berkas SPA Signed dan Konfirmasi Bank di dalam Folder Leads
 */
export async function checkFilesInLeadFolder(folderId: string): Promise<{
  hasSpa: boolean;
  hasBankEmail: boolean;
  spaFile?: { id: string; name: string; url: string };
  bankEmailFile?: { id: string; name: string; url: string };
}> {
  const drive = await getDriveService();
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      pageSize: 30
    });

    const files = res.data.files || [];
    let hasSpa = false;
    let hasBankEmail = false;
    let spaFile: any = null;
    let bankEmailFile: any = null;

    for (const f of files) {
      const nameLower = (f.name || '').toLowerCase();
      if (nameLower.includes('spa') && nameLower.endsWith('.pdf')) {
        hasSpa = true;
        spaFile = { id: f.id, name: f.name, url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view` };
      }
      if ((nameLower.includes('konfirmasi') || nameLower.includes('email') || nameLower.includes('plafond')) && nameLower.endsWith('.pdf')) {
        hasBankEmail = true;
        bankEmailFile = { id: f.id, name: f.name, url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view` };
      }
    }

    return { hasSpa, hasBankEmail, spaFile, bankEmailFile };
  } catch {
    return { hasSpa: false, hasBankEmail: false };
  }
}

