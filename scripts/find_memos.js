const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function getAccessToken() {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kpr-automation.json'), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
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

async function searchMemos() {
  const token = await getAccessToken();

  // Test root folder access first: 1Dol_HE0A7AqgUe1K-QIaIX9E78Xfmtnv
  // Notice in screenshot 1:
  // URL: drive.google.com/drive/folders/1Dol_HE0A7AqgUe1K-QIaIX9E78Xfmtnv
  // Let's test if access was granted
  const rootId = '1Dol_HE0A7AqgUe1K-QIaIX9E78Xfmtnv';
  const rootRes = await fetch(`https://www.googleapis.com/drive/v3/files/${rootId}?fields=id,name,webViewLink`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`Checking folder ${rootId}: status ${rootRes.status}`);
  if (rootRes.status === 200) {
    console.log('Access granted to Cashback root folder!', await rootRes.json());
  }

  // Search for any files or folders containing "Memo"
  const queries = [
    "name contains 'Memo' and trashed = false",
    "name contains 'Cashback' and trashed = false",
    "name contains 'NND' and trashed = false",
    "name contains 'WMI' and trashed = false"
  ];

  for (const q of queries) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=25`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`\nQuery "${q}": found ${data.files ? data.files.length : 0} items`);
    if (data.files) {
      data.files.forEach(f => {
        console.log(`  - [${f.mimeType === 'application/vnd.google-apps.folder' ? 'DIR' : 'FILE'}] ${f.name} (id: ${f.id}, parents: ${f.parents ? f.parents.join(',') : 'none'})`);
      });
    }
  }
}

searchMemos().catch(console.error);
