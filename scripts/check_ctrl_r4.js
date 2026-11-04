const fs = require('fs');
const path = require('path');

async function checkCtrlRow4() {
  const token = await (async () => {
    const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kpr-automation.json'), 'utf8'));
    const crypto = require('crypto');
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = { iss: creds.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now };
    const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const u = enc(header) + '.' + enc(claim);
    const s = crypto.createSign('RSA-SHA256').update(u).sign(creds.private_key, 'base64url');
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: u + '.' + s }) });
    return (await res.json()).access_token;
  })();

  const ctrlId = '1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag';
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ctrlId}/values/'Daftar Transaksi KPR'!A4:K4`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Controller Row 4:', data.values ? data.values[0] : []);
}

checkCtrlRow4().catch(console.error);
