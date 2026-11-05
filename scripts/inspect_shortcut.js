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

async function inspectShortcutTarget() {
  const token = await getAccessToken();

  for (const scId of ['1UBECqWb3-LwM96oEMtIckg0UTOV8BK9E', '1dg3XgDsRx4_KG0yqafYkqVOybqwK9ahh']) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${scId}?fields=id,name,shortcutDetails,parents,webViewLink`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`Shortcut ${scId}:`, data);

    const targetId = data.shortcutDetails?.targetId;
    if (targetId) {
      console.log(`Fetching target spreadsheet [${targetId}]...`);
      const tRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/'PR Request'!A1:H45`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tData = await tRes.json();
      console.log(`Target spreadsheet content for ${data.name}:`);
      (tData.values || []).forEach((r, idx) => {
        if (r.some(c => c)) console.log(`Row ${idx + 1}:`, r);
      });
    }
  }
}

inspectShortcutTarget().catch(console.error);
