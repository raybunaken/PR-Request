const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function getAccessToken() {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kpr-automation.json'), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

async function inspectTabs() {
  const token = await getAccessToken();
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Tabs in Akad Spreadsheet:');
  const sheetNames = data.sheets.map(s => s.properties.title);
  console.log(sheetNames);

  for (const name of sheetNames) {
    const qRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'${name}'!A1:Z500`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const qData = await qRes.json();
    const rows = qData.values || [];
    rows.forEach((r, idx) => {
      const rowStr = JSON.stringify(r);
      if (rowStr.toLowerCase().includes('noor') || rowStr.toLowerCase().includes('holis') || rowStr.toLowerCase().includes('ihsan')) {
        console.log(`[Tab: ${name}] Found at row ${idx + 1}:`, r.slice(0, 10));
      }
    });
  }
}

inspectTabs().catch(console.error);
