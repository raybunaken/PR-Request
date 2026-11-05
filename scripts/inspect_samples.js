const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function getAccessToken() {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kpr-automation.json'), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
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

async function inspectSampleFolders() {
  const token = await getAccessToken();

  for (const fId of ['1fk74EtNlNobOEA3nVqq12SbFRGecllES', '11H3vEz5iRXQLrGcaWEl74fyh2CyaShWJ']) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${fId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)&pageSize=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`\n=== FOLDER [${fId}] FILES: ===`);
    (data.files || []).forEach(f => {
      console.log(`  * ${f.name} (${f.mimeType}) [${f.id}]`);
    });

    const prFile = data.files?.find(f => f.name.toLowerCase().includes('pr'));
    if (prFile) {
      console.log(`\n--- Inspecting PR File: ${prFile.name} [${prFile.id}] ---`);
      const prRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${prFile.id}/values/'PR Request'!A1:H45`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const prData = await prRes.json();
      (prData.values || []).forEach((r, idx) => {
        if (r.some(c => c)) console.log(`Row ${idx + 1}:`, r);
      });
    }
  }
}

inspectSampleFolders().catch(console.error);
