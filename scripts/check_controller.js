const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const credsPath = path.join(__dirname, '..', 'kpr-automation.json');
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(claim)}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(creds.private_key, 'base64url');
  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  return data.access_token;
}

const CONTROLLER_ID = '1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag';

async function main() {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONTROLLER_ID}/values/'Daftar Transaksi KPR'!A1:L200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  const rows = data.values || [];

  console.log(`Controller Sheet rows: ${rows.length}`);
  const septDeals = rows.filter(r => {
    const tgl = (r[2] || '').trim();
    return tgl.includes('09/') || tgl.includes('/09') || tgl.toLowerCase().includes('sep');
  });

  console.log(`Found ${septDeals.length} September deals in Controller sheet:`);
  septDeals.forEach(r => {
    console.log(`Row: ${r[0]} | ${r[1]} | Tgl: ${r[2]} | Bank: ${r[3]} | Leads Folder: ${r[9]} | Status: ${r[10]}`);
  });
}

main().catch(console.error);
