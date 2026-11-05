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

async function inspectFolder() {
  const token = await getAccessToken();
  const folderId = '1Vs_XMYUwu20xXWXC1Px4rRSynE-GsQCp';
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,parents,webViewLink`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Folder info:', data);

  // Also search for any files mentioning "Cashback" across the entire drive
  const q = encodeURIComponent(`fullText contains 'cashback' and trashed = false`);
  const sRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=20`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const sData = await sRes.json();
  console.log('Drive fullText search for cashback:', sData.files ? sData.files.map(f => ({ name: f.name, id: f.id })) : []);
}

inspectFolder().catch(console.error);
