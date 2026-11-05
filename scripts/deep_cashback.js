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

async function deepCashback() {
  const token = await getAccessToken();
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';

  // 1. Fetch formula / hyperlinks in 'Leads Cashback'
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'Leads Cashback'!A1:J20?valueRenderOption=FORMULA`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('=== FORMULA IN LEADS CASHBACK ===');
  data.values.forEach((r, idx) => {
    console.log(`Row ${idx + 1}: ${r[0]} | Cashback: ${r[6]} | Progress: ${r[7]} | Folder: ${r[9]}`);
  });

  // 2. Check All - Akad Transaction for cashback > 0
  const akadRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'All - Akad Transaction'!A1:AJ400`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const akadData = await akadRes.json();
  const rows = akadData.values || [];
  console.log('\n=== TRANSACTIONS WITH CASHBACK IN ALL - AKAD TRANSACTION ===');
  rows.forEach((r, idx) => {
    const cb = r[8]; // Col I (index 8)
    if (cb && cb !== '0' && cb !== 'Rp0' && cb !== '-' && cb !== 'Rp -' && cb !== '') {
      console.log(`Row ${idx + 1}: Cust: "${r[1]}" | Bank: "${r[5]}" | Plafond: "${r[6]}" | Cashback: "${cb}" | Grouping: "${r[7]}" | MO: "${r[27]}" | Folder: "${r[23]}"`);
    }
  });

  // 3. Search Drive for Shinta, Sarah, Fawwaz, or Nisa folders to see where they are stored
  console.log('\n=== CHECKING EXISTING CASHBACK FOLDERS IN DRIVE ===');
  for (const name of ['Nisa Nurul Khalili', 'Fawwaz Ihsan', 'Calma Radella']) {
    const q = encodeURIComponent(`name contains '${name}' and trashed = false`);
    const dRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dData = await dRes.json();
    console.log(`Files for "${name}":`, dData.files ? dData.files.map(f => ({ name: f.name, id: f.id, parents: f.parents })) : []);
  }
}

deepCashback().catch(console.error);
