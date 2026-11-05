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

async function testCashbackFlow() {
  const token = await getAccessToken();

  // Test API endpoint logic directly
  console.log('Testing Cashback data fetch...');
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';
  const rootId = '1Dol_HE0A7AqgUe1K-QLafX9E78Xfmtnv';

  const akadRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'All - Akad Transaction'!A1:AJ500`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const akadRows = (await akadRes.json()).values || [];

  const cbRows = akadRows.filter((r, idx) => {
    if (idx === 0) return false;
    const cb = String(r[8] || '').replace(/[^0-9]/g, '');
    return parseInt(cb || '0', 10) > 0;
  });

  console.log(`Found ${cbRows.length} cashback deals in All - Akad Transaction:`);
  cbRows.forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r[1]} | Bank: ${r[5]} | Plafond: ${r[6]} | Cashback: ${r[8]} | MO: ${r[27]}`);
  });

  // Verify Drive Folders in Cashback root
  const dRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${rootId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&pageSize=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const dData = await dRes.json();
  console.log(`\nFound ${dData.files?.length || 0} existing items in Drive Cashback folder:`);
  dData.files?.forEach(f => console.log(`  * ${f.name} (${f.mimeType})`));
}

testCashbackFlow().catch(console.error);
