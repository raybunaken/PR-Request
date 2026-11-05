const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function getAccessToken() {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kpr-automation.json'), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const u = enc(header) + '.' + enc(claim);
  const s = crypto.createSign('RSA-SHA256').update(u).sign(creds.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: u + '.' + s })
  });
  return (await res.json()).access_token;
}

async function inspectAlvienFolder() {
  const token = await getAccessToken();
  const folderId = '1Nh2WKGoRGouqTMPKrXC3Vqm_IwKPF-yY';

  // 1. Get folder details
  const fRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,parents,webViewLink`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const fData = await fRes.json();
  console.log('Alvien folder info:', fData);

  if (fData.parents) {
    const pId = fData.parents[0];
    const pRes = await fetch(`https://www.googleapis.com/drive/v3/files/${pId}?fields=id,name,parents,webViewLink`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Parent folder (Cashback root) info:', await pRes.json());
  }

  // 2. List files inside Alvien folder
  const filesRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)&pageSize=20`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const filesData = await filesRes.json();
  console.log('\nFiles inside Alvien folder:');
  console.log(filesData.files);

  // 3. Inspect PR Request file inside Alvien folder
  const prFile = filesData.files?.find(f => f.name.toLowerCase().includes('pr'));
  if (prFile) {
    console.log(`\n=== PR FILE DETAILS: ${prFile.name} [${prFile.id}] ===`);
    const prRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${prFile.id}/values/'PR Request'!A1:H45`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const prSheetData = await prRes.json();
    (prSheetData.values || []).forEach((r, idx) => {
      if (r.some(c => c)) console.log(`Row ${idx + 1}:`, r);
    });
  }
}

inspectAlvienFolder().catch(console.error);
