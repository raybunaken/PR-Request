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

async function searchBankAccounts() {
  const token = await getAccessToken();
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';

  // Let's check sheet names and full columns in 'Leads Cashback'
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'Leads Cashback'!A1:Z15`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Leads Cashback full headers and row 2:');
  console.log('Headers:', data.values ? data.values[0] : []);
  console.log('Row 2:', data.values ? data.values[1] : []);

  // Check if there are any PR files already generated for any of the cashback customers:
  // Customers: 'Shinta', 'Sarah', 'Nisa Nurul Khalili', 'Fawwaz Ihsan', 'Calma Radella', 'Hendi', 'Ricky Kurniawan', 'Alvin Haris', 'Veny'
  for (const name of ['Shinta', 'Sarah', 'Nisa Nurul', 'Hendi', 'Alvin Haris']) {
    const q = encodeURIComponent(`name contains 'PR' and name contains '${name}' and trashed = false`);
    const dRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dData = await dRes.json();
    console.log(`PR files for ${name}:`, dData.files ? dData.files.map(f => f.name) : []);
  }

  // Also check if there's a folder named "Cashback" in Drive
  const qFolder = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name contains 'Cashback' and trashed = false`);
  const fRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${qFolder}&fields=files(id,name,parents,webViewLink)&pageSize=10`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const fData = await fRes.json();
  console.log('Cashback folders found:', fData.files);
}

searchBankAccounts().catch(console.error);
