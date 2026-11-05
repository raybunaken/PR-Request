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

async function testPermutations() {
  const token = await getAccessToken();

  // Permutations of l / I / 1 / f / I
  const p1 = ['1Dol', '1DoI', '1DOl', '1DOI'];
  const p2 = ['QIaf', 'Qlaf', 'Q1af', 'QIaI', 'QlaI', 'QlafX', 'QIafX'];
  
  const ids = [];
  for (const a of p1) {
    for (const b of ['QIaf', 'Qlaf', 'Q1af', 'QIal', 'QIaI', 'Qlal']) {
      ids.push(`${a}_HE0A7AqgUe1K-${b}X9E78Xfmtnv`);
      ids.push(`${a}_HE0A7AqgUe1K-${b}9E78Xfmtnv`);
    }
  }

  // Also check screenshot 1 exact URL
  // "drive.google.com/drive/folders/1Dol_HE0A7AqgUe1K-QIaIX9E78Xfmtnv"
  // Look at "QIaIX9E78Xfmtnv" -> wait, is that "QIaIX" or "OIaIX"?
  console.log(`Testing ${ids.length} permutations...`);
  for (const id of ids) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,webViewLink`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 200) {
      const data = await res.json();
      console.log('SUCCESS! Found folder:', data);
      return;
    }
  }
  console.log('None of the permutations succeeded directly. It is likely that the Service Account has not been shared to this folder yet, or the ID differs.');
}

testPermutations().catch(console.error);
