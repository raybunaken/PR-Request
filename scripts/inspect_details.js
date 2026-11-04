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

async function getFileInfo(token, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,parents,webViewLink`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return await res.json();
}

async function listFiles(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,webViewLink)&pageSize=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).files || [];
}

async function main() {
  const token = await getAccessToken();

  console.log('--- Inspecting Nur Aslinda folder ---');
  const fNur = await getFileInfo(token, '1h5nXUdx87F2uKhknz3cIjfcEL4OkmqPN');
  console.log('Nur Aslinda info:', fNur);
  const filesNur = await listFiles(token, '1h5nXUdx87F2uKhknz3cIjfcEL4OkmqPN');
  console.log('Nur Aslinda files:', filesNur.map(f => f.name));

  console.log('\n--- Inspecting Juligo folders ---');
  const fJuligo1 = await getFileInfo(token, '1YF_dV4vTDrUGvycLENNgr5VipNeiU8np');
  const filesJ1 = await listFiles(token, '1YF_dV4vTDrUGvycLENNgr5VipNeiU8np');
  console.log('Juligo 1 (M26335 - juligo al paraby saragih):', filesJ1.map(f => f.name), fJuligo1.parents);

  const fJuligo2 = await getFileInfo(token, '157gmrloFBNUUAssoCZre5iTjmdflF6hR');
  const filesJ2 = await listFiles(token, '157gmrloFBNUUAssoCZre5iTjmdflF6hR');
  console.log('Juligo 2 (M26335 - Juligo Saragih):', filesJ2.map(f => f.name), fJuligo2.parents);

  console.log('\n--- Inspecting Luthfan folders ---');
  const fLuthfan1 = await getFileInfo(token, '1psjMTPoVlncXqLcG0qUvTW1z_wbR1V7u');
  const filesL1 = await listFiles(token, '1psjMTPoVlncXqLcG0qUvTW1z_wbR1V7u');
  console.log('Luthfan 1 (M26337 - Luthfan Areka Adi):', filesL1.map(f => f.name));

  const fLuthfan2 = await getFileInfo(token, '1seT9B5ali58QGLOnaz1Q3k-LwbSKy2Mu');
  const filesL2 = await listFiles(token, '1seT9B5ali58QGLOnaz1Q3k-LwbSKy2Mu');
  console.log('Luthfan 2 (Luthfan Areka Adi):', filesL2.map(f => f.name));
}

main().catch(console.error);
