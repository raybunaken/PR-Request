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
    scope: 'https://www.googleapis.com/auth/drive',
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

async function searchDrive(token, query) {
  const q = encodeURIComponent(`name contains '${query}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.files || [];
}

async function main() {
  const token = await getAccessToken();
  const searchTerms = [
    'Nur Aslinda', 'Aslinda',
    'Roy lesmana', 'lesmana',
    'Narwasta', 'Rimba',
    'Sadarin',
    'juligo',
    'Luthfan',
    'Jumadi',
    'Pribadi Nata'
  ];

  for (const term of searchTerms) {
    const files = await searchDrive(token, term);
    console.log(`\nSearch for "${term}": found ${files.length} items`);
    files.forEach(f => {
      console.log(`  - [${f.mimeType === 'application/vnd.google-apps.folder' ? 'DIR' : 'FILE'}] ${f.name} (id: ${f.id})`);
    });
  }
}

main().catch(console.error);
