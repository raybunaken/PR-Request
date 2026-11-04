const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const credsPath = path.join(__dirname, '..', 'kpr-automation.json');
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(claim)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(creds.private_key, 'base64url');
  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  return data.access_token;
}

async function listFilesInFolder(token, folderId) {
  let files = [];
  let pageToken = null;
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,webViewLink)&pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.files) {
      files.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, 'september_audit_raw.json'), 'utf8'));
  const { septemberDeals, driveFolders } = rawData;
  const token = await getAccessToken();

  console.log('Inspecting Drive folders contents...');
  
  // Cache files in drive folders
  const folderContents = {};
  for (const f of driveFolders) {
    const files = await listFilesInFolder(token, f.id);
    folderContents[f.id] = {
      folder: f,
      files: files
    };
  }

  // Find customers with duplicate names but different MO codes in September
  const custNameCounts = {};
  for (const d of septemberDeals) {
    const key = normalize(d.customer);
    if (!custNameCounts[key]) custNameCounts[key] = [];
    custNameCounts[key].push(d);
  }

  const multiMODeals = Object.values(custNameCounts).filter(arr => arr.length > 1);

  // Match each deal to Drive folders
  const results = [];

  for (const deal of septemberDeals) {
    const dealNorm = normalize(deal.customer);
    const moNorm = normalize(deal.moCode);

    // Look for matched folder in driveFolders
    // Folder naming can be: "[#MO] - [Customer Name]" or just "[#MO]" or "[Customer Name]"
    let matchedFolder = null;

    for (const f of driveFolders) {
      const fNorm = normalize(f.name);
      // Priority 1: Match MO code if MO code exists and length >= 4
      if (moNorm && moNorm.length >= 4 && fNorm.includes(moNorm)) {
        matchedFolder = f;
        break;
      }
    }

    // If not matched by MO, try customer name
    if (!matchedFolder) {
      for (const f of driveFolders) {
        const fNorm = normalize(f.name);
        if (dealNorm && dealNorm.length >= 4 && (fNorm.includes(dealNorm) || dealNorm.includes(fNorm))) {
          matchedFolder = f;
          break;
        }
      }
    }

    let files = [];
    let hasSpa = false;
    let hasBankEmail = false;
    let spaFileName = '';
    let bankEmailFileName = '';

    if (matchedFolder) {
      const fc = folderContents[matchedFolder.id];
      files = fc ? fc.files : [];
      for (const file of files) {
        const fn = (file.name || '').toLowerCase();
        if (fn.includes('spa') && fn.endsWith('.pdf')) {
          hasSpa = true;
          spaFileName = file.name;
        }
        if ((fn.includes('konfirmasi') || fn.includes('email') || fn.includes('plafond') || fn.includes('ol_') || fn.includes('sp3k') || fn.includes('persetujuan')) && fn.endsWith('.pdf')) {
          hasBankEmail = true;
          bankEmailFileName = file.name;
        }
      }
    }

    // Check completeness
    let status = 'LENGKAP';
    if (!matchedFolder) {
      status = 'FOLDER_TIDAK_ADA';
    } else if (!hasSpa && !hasBankEmail) {
      status = 'KOSONG_TIDAK_ADA_FILE';
    } else if (!hasSpa) {
      status = 'BELUM_ADA_SPA';
    } else if (!hasBankEmail) {
      status = 'BELUM_ADA_EMAIL_BANK';
    }

    results.push({
      rowNumber: deal.rowNumber,
      customer: deal.customer,
      moCode: deal.moCode,
      tglAkad: deal.tglAkad,
      bank: deal.bank,
      akadCode: deal.akadCode,
      leadsFolderCol: deal.leadsFolderCol,
      folderFound: !!matchedFolder,
      folderName: matchedFolder ? matchedFolder.name : null,
      folderUrl: matchedFolder ? matchedFolder.webViewLink : null,
      folderId: matchedFolder ? matchedFolder.id : null,
      fileCount: files.length,
      filesList: files.map(x => x.name),
      hasSpa,
      spaFileName,
      hasBankEmail,
      bankEmailFileName,
      status
    });
  }

  fs.writeFileSync(path.join(__dirname, 'september_audit_results.json'), JSON.stringify({
    summary: {
      totalSeptemberDeals: septemberDeals.length,
      folderMissingCount: results.filter(r => r.status === 'FOLDER_TIDAK_ADA').length,
      incompleteCount: results.filter(r => r.status !== 'LENGKAP' && r.status !== 'FOLDER_TIDAK_ADA').length,
      completeCount: results.filter(r => r.status === 'LENGKAP').length,
      multiMODealsCount: multiMODeals.length
    },
    multiMODeals,
    results
  }, null, 2));

  console.log('Analysis complete!');
  console.log('Summary:');
  console.log(`Total September Deals: ${septemberDeals.length}`);
  console.log(`Folders Missing: ${results.filter(r => r.status === 'FOLDER_TIDAK_ADA').length}`);
  console.log(`Folders Incomplete: ${results.filter(r => r.status !== 'LENGKAP' && r.status !== 'FOLDER_TIDAK_ADA').length}`);
  console.log(`Folders Complete: ${results.filter(r => r.status === 'LENGKAP').length}`);
  console.log(`Multi-MO deals (same name, diff MO): ${multiMODeals.length}`);
}

main().catch(console.error);
