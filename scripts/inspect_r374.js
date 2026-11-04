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

const colLetters = (idx) => {
  let s = '';
  while (idx >= 0) {
    s = String.fromCharCode((idx % 26) + 65) + s;
    idx = Math.floor(idx / 26) - 1;
  }
  return s;
};

async function inspectRow374() {
  const token = await getAccessToken();
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'All - Akad Transaction'!A1:AJ375`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const rows = data.values || [];
  const header = rows[0];
  const r374 = rows[373]; // 0-indexed for row 374

  console.log('=== ROW 374 (Noor Holis Ihsan) IN ALL - AKAD TRANSACTION ===');
  for (let i = 0; i < Math.max(header.length, r374.length); i++) {
    const colName = colLetters(i);
    const head = header[i] || '(empty header)';
    const val = r374[i] !== undefined ? r374[i] : '(empty)';
    console.log(`Col ${colName} [${i}] | ${head.replace(/\n/g, ' ')}: "${val}"`);
  }
}

inspectRow374().catch(console.error);
