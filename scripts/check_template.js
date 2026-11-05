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

async function inspectTemplate() {
  const token = await getAccessToken();
  const templateId = '1QlRwxUp9taMCfYLqwOxfEShTGGIX3Btat2GsI_GOqtQ';

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${templateId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Template sheets:', data.sheets.map(s => s.properties.title));

  const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${templateId}/values/'PR Request'!A1:H45`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const valData = await valRes.json();
  console.log('Template values:');
  (valData.values || []).forEach((r, idx) => {
    if (r.some(c => c)) console.log(`Row ${idx + 1}:`, r.filter(c => c));
  });
}

inspectTemplate().catch(console.error);
