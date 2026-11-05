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

async function inspectCashback() {
  const token = await getAccessToken();
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';

  // 1. Inspect 'Leads Cashback' tab
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'Leads Cashback'!A1:Z50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const rows = data.values || [];
  console.log('=== LEADS CASHBACK TAB ===');
  console.log('Header:', rows[0]);
  console.log('Rows count:', rows.length);
  for (let i = 1; i < Math.min(10, rows.length); i++) {
    console.log(`Row ${i + 1}:`, rows[i]);
  }

  // 2. Search Drive for PR Cashback or Cashback Templates or Folders
  const searchQueries = ['Cashback', 'PR Cashback', 'Template Cashback', 'KPR Cashback'];
  for (const qTerm of searchQueries) {
    const q = encodeURIComponent(`name contains '${qTerm}' and trashed = false`);
    const dRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=15`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dData = await dRes.json();
    console.log(`\n=== DRIVE SEARCH FOR "${qTerm}" (found ${dData.files ? dData.files.length : 0}) ===`);
    if (dData.files) {
      dData.files.forEach(f => console.log(`  - [${f.mimeType === 'application/vnd.google-apps.folder' ? 'DIR' : 'FILE'}] ${f.name} (id: ${f.id})`));
    }
  }
}

inspectCashback().catch(console.error);
