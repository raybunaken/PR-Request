const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function getAccessToken() {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kpr-automation.json'), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
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

async function listRootFolders() {
  const token = await getAccessToken();
  const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,parents)&pageSize=50`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`Total accessible folders: ${data.files ? data.files.length : 0}`);
  if (data.files) {
    data.files.forEach(f => {
      console.log(`- Folder: "${f.name}" (id: ${f.id}, parents: ${f.parents ? f.parents.join(',') : 'root'})`);
    });
  }
}

listRootFolders().catch(console.error);
