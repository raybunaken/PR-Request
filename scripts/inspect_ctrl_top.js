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

async function inspectCtrl() {
  const token = await getAccessToken();
  const ctrlId = '1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag';

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ctrlId}/values/'Daftar Transaksi KPR'!A1:K15`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const rows = data.values || [];

  console.log('=== CONTROLLER SHEET (Daftar Transaksi KPR) ROWS 1-15 ===');
  rows.forEach((r, idx) => {
    console.log(`Row ${idx + 1} | DB Row: "${r[0]}" | Cust: "${r[1]}" | Tgl: "${r[2]}" | Bank: "${r[3]}" | Agent%: "${r[4]}" | AgentName: "${r[5]}" | Comm: "${r[6]}" | StatusPR: "${r[10]}"`);
  });
}

inspectCtrl().catch(console.error);
