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

async function search(token, query) {
  const q = encodeURIComponent(`name contains '${query}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=30`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.files || [];
}

async function main() {
  const token = await getAccessToken();
  const queries = ['M26330', 'M26346', 'M26348', 'Aslinda', 'Roy', 'Narwasta'];
  for (const q of queries) {
    const res = await search(token, q);
    console.log(`Results for ${q}: ${res.length}`);
    res.forEach(r => console.log(`  - ${r.name} (${r.mimeType}) [${r.id}] parents: ${r.parents ? r.parents.join(',') : 'none'}`));
  }
}

main().catch(console.error);
