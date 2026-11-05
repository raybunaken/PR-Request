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

async function inspectValidasi() {
  const token = await getAccessToken();
  const fileId = '11cZHpIV6GahTra0zNacABwxHJITQ19HGlsqPlRb7-0c';

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Tabs in Validasi Case Nasabah KPR:');
  console.log(data.sheets ? data.sheets.map(s => s.properties.title) : data);

  // If there are tabs, read sample from relevant ones
  if (data.sheets) {
    for (const s of data.sheets) {
      const title = s.properties.title;
      if (title.toLowerCase().includes('cashback') || title.toLowerCase().includes('pr') || title.toLowerCase().includes('klaim')) {
        const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/'${title}'!A1:Z10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const valData = await valRes.json();
        console.log(`\nSample from tab "${title}":`, valData.values ? valData.values[0] : 'no data');
      }
    }
  }
}

inspectValidasi().catch(console.error);
