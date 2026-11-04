const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function getAccessToken() {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kpr-automation.json'), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

async function updateControllerRow4() {
  const token = await getAccessToken();
  const ctrlId = '1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag';

  // Row 4 in Daftar Transaksi KPR corresponds to DB Row 374 (Noor Holis Ihsan)
  // Commission calculation for Muamalat:
  // Plafond: 505.000.000, Gross: 5.050.000
  // DPP = 5.050.000 / 1.11 = 4.549.549,55
  // PPh 23 = DPP * 0.02 = 90.990,99
  // Net = 5.050.000 - 90.990,99 = 4.959.009,01
  // Agent (85%) = Math.round(4.959.009,01 * 0.85) = 4.215.158

  const values = [
    [
      374,
      'Noor Holis Ihsan',
      '10/30/2026',
      'Muamalat',
      '85%',
      'Irene Dyah Rhespati',
      4215158,
      'Belum Lunas (Estimasi)',
      'PT. Web Marketing Indonesia',
      '',
      'Belum Dibuat'
    ]
  ];

  console.log('Updating Daftar Transaksi KPR row 4...');
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ctrlId}/values/'Daftar Transaksi KPR'!A4:K4?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });
  const data = await res.json();
  console.log('Controller update result:', data);

  // Also update Agent Comission tab in Akad Spreadsheet if needed
  const akadId = '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8';
  console.log('Updating tab Agent Comission row 153...');
  const agentComValues = [
    [
      4215158,
      'Irene Dyah Rhespati'
    ]
  ];
  const res2 = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${akadId}/values/'Agent Comission'!G153:H153?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: agentComValues })
  });
  const data2 = await res2.json();
  console.log('Agent Comission tab update result:', data2);
}

updateControllerRow4().catch(console.error);
