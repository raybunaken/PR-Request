const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'september_audit_raw.json'), 'utf8'));
const { septemberDeals } = raw;

console.log('--- ALL DEALS BY AKAD CODE ---');
const codes = {};
septemberDeals.forEach(d => {
  codes[d.akadCode] = (codes[d.akadCode] || 0) + 1;
});
console.log('Akad Codes distribution:', codes);

console.log('\n--- 2026 SEPTEMBER DEALS (Code 0926 or Year 2026) ---');
const sept2026 = septemberDeals.filter(d => d.akadCode === '0926' || d.tglAkad.includes('2026') || d.tglAkad.includes('26'));
console.log(`Total September 2026 deals: ${sept2026.length}`);
sept2026.forEach(d => {
  console.log(`Row ${d.rowNumber} | ${d.customer} | MO: ${d.moCode} | Bank: ${d.bank} | Tgl: ${d.tglAkad} | Plafond: ${d.plafond}`);
});
