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

async function search() {
  const token = await getAccessToken();
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';
  const ctrlId = '1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag';

  // Search Akad Sheet
  const resAkad = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'All - Akad Transaction'!A1:AJ1000`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const dataAkad = await resAkad.json();
  const rowsAkad = dataAkad.values || [];

  console.log('=== SEARCHING IN ALL - AKAD TRANSACTION ===');
  console.log(`Total rows in Akad Sheet: ${rowsAkad.length}`);
  rowsAkad.forEach((r, idx) => {
    const rowStr = JSON.stringify(r);
    if (rowStr.toLowerCase().includes('noor') || rowStr.toLowerCase().includes('holis')) {
      console.log(`Found in Akad Sheet Row ${idx + 1}:`);
      console.log(r);
    }
  });

  // Search Controller Sheet
  const resCtrl = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ctrlId}/values/'Daftar Transaksi KPR'!A1:Z500`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const dataCtrl = await resCtrl.json();
  const rowsCtrl = dataCtrl.values || [];

  console.log('\n=== SEARCHING IN CONTROLLER SHEET (Daftar Transaksi KPR) ===');
  console.log(`Total rows in Controller Sheet: ${rowsCtrl.length}`);
  rowsCtrl.forEach((r, idx) => {
    const rowStr = JSON.stringify(r);
    if (rowStr.toLowerCase().includes('noor') || rowStr.toLowerCase().includes('holis')) {
      console.log(`Found in Controller Sheet Row ${idx + 1}:`);
      console.log(r);
    }
  });
}

search().catch(console.error);
