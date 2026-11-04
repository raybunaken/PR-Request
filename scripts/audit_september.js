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
  if (!data.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

const AKAD_SPREADSHEET_ID = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';
const FINANCE_LEADS_ROOT_FOLDER_ID = '1KlCBYpZfk7vHyHqdcuUDiKo9RsRBpnJO';

async function listAllDriveFolders(token, parentId) {
  let folders = [];
  let pageToken = null;
  do {
    const q = encodeURIComponent(`'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,webViewLink)&pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.files) {
      folders.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return folders;
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

async function main() {
  const token = await getAccessToken();

  // 1. Fetch Akad sheet rows
  console.log('Fetching Akad sheet rows...');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${AKAD_SPREADSHEET_ID}/values/'All - Akad Transaction'!A1:AJ1000`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const sheetData = await res.json();
  const rows = sheetData.values || [];

  console.log(`Total rows in sheet: ${rows.length}`);

  // Inspect headers
  const header = rows[0];

  // Let's filter for September deals
  // Tanggal Akad is index 4, Tanggal Akad Code is index 31
  const septemberDeals = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const customer = (r[1] || '').trim();
    if (!customer) continue;

    const tglAkad = (r[4] || '').trim();
    const akadCode = (r[31] || '').trim();
    const bank = (r[5] || '').trim();
    const moCode = (r[27] || '').trim();
    const leadsFolderCol = (r[23] || '').trim();
    const type = (r[3] || '').trim();
    const plafond = r[6] || '';
    const agentComm = r[18] || '';

    // Check if September
    // Akad code might be '0926' or '0924' or '0925' or tglAkad contains /09/ or Sep or Sept
    const isSept = akadCode.startsWith('09') || 
                   /(\/09\/|\.09\.|-09-|sep|sept)/i.test(tglAkad);

    if (isSept) {
      septemberDeals.push({
        rowNumber: i + 1,
        customer,
        tglAkad,
        akadCode,
        bank,
        moCode,
        leadsFolderCol,
        type,
        plafond,
        agentComm
      });
    }
  }

  console.log(`Found ${septemberDeals.length} September transactions in All - Akad Transaction.`);

  // 2. Fetch all folders in Finance Leads Root
  console.log('Fetching Drive folders in Finance Leads Root Folder...');
  const driveFolders = await listAllDriveFolders(token, FINANCE_LEADS_ROOT_FOLDER_ID);
  console.log(`Found ${driveFolders.length} folders in Finance Leads Root Folder.`);

  // Write out raw summary to a json file for deep inspection
  fs.writeFileSync(
    path.join(__dirname, 'september_audit_raw.json'),
    JSON.stringify({ septemberDeals, driveFolders }, null, 2)
  );

  console.log('Raw data saved to scripts/september_audit_raw.json');
}

main().catch(console.error);
