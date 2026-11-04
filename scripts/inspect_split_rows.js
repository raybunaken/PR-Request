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
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

const AKAD_SPREADSHEET_ID = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';

async function main() {
  const token = await getAccessToken();
  const rowsToFetch = [328, 329, 333, 334, 335, 336, 343, 344, 345, 351];
  
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${AKAD_SPREADSHEET_ID}/values/'All - Akad Transaction'!A327:AF352`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const allRows = data.values || [];

  rowsToFetch.forEach(rowNum => {
    const idx = rowNum - 327;
    const r = allRows[idx] || [];
    console.log(`Row ${rowNum}:`);
    console.log(`  Cust: ${r[1]} | Bank: ${r[5]} | Plafond: ${r[6]} | % Bank: ${r[9]} | Bank Comm: ${r[10]}`);
    console.log(`  Col X (Leads Folder): "${r[23] || ''}"`);
    console.log(`  Col AB (#MO): "${r[27] || ''}"`);
    console.log(`  Col AC (PIC): "${r[28] || ''}"`);
    console.log(`  Col AD (Email sent?): "${r[29] || ''}"`);
  });
}

main().catch(console.error);
