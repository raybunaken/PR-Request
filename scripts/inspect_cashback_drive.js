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

async function inspectCashbackDrive() {
  const token = await getAccessToken();
  const rootId = '1Dol_HE0A7AqgUe1K-QIaIX9E78Xfmtnv';

  // 1. Check Root folder info and contents
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${rootId}?fields=id,name,webViewLink,capabilities`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Root Folder info:', await res.json());

  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${rootId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)&pageSize=30`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log('\nSubfolders / files in Cashback Root:');
  console.log(listData.files ? listData.files.map(f => `${f.name} (${f.mimeType}) [${f.id}]`) : listData);

  // 2. Find Memo folder and list files in it
  const memoFolder = listData.files?.find(f => f.name.toLowerCase() === 'memo');
  if (memoFolder) {
    const memoRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${memoFolder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)&pageSize=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const memoData = await memoRes.json();
    console.log('\nFiles inside Memo folder:');
    console.log(memoData.files ? memoData.files.map(f => `${f.name} [${f.id}]`) : memoData);
  }

  // 3. Find Alvien Khairullah folder and inspect its PR Request file
  const alvienFolder = listData.files?.find(f => f.name.toLowerCase().includes('alvien'));
  if (alvienFolder) {
    const aRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${alvienFolder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)&pageSize=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const aData = await aRes.json();
    console.log(`\nFiles inside Alvien Khairullah folder [${alvienFolder.id}]:`);
    console.log(aData.files ? aData.files.map(f => `${f.name} (${f.mimeType}) [${f.id}]`) : aData);

    const prFile = aData.files?.find(f => f.name.toLowerCase().includes('pr'));
    if (prFile) {
      console.log(`\nInspecting PR file: ${prFile.name} [${prFile.id}]`);
      const prDataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${prFile.id}/values/'PR Request'!A1:H45`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const prData = await prDataRes.json();
      console.log('PR Data values:');
      (prData.values || []).forEach((r, idx) => {
        if (r.some(c => c)) console.log(`Row ${idx + 1}:`, r.filter(c => c));
      });
    }
  }
}

inspectCashbackDrive().catch(console.error);
