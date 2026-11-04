const fs = require('fs');
const path = require('path');

const res = JSON.parse(fs.readFileSync(path.join(__dirname, 'september_audit_results.json'), 'utf8'));
const sept2026 = res.results.filter(r => r.rowNumber >= 328 && r.rowNumber <= 352);

console.log('=== BREAKDOWN OF ALL 25 SEPTEMBER 2026 TRANSACTIONS ===\n');

// 1. Completely Missing Folders
const missingFolders = sept2026.filter(r => r.status === 'FOLDER_TIDAK_ADA');
console.log(`1. FOLDER BELUM DIBUAT SAMA SEKALI (${missingFolders.length} deals):`);
missingFolders.forEach(r => {
  console.log(`   - Row ${r.rowNumber} | MO: ${r.moCode} | ${r.customer} | ${r.bank} | Tgl: ${r.tglAkad}`);
});

// 2. Multi-MO Missing Separate Folders
console.log('\n2. DUPLIKAT NAMA TAPI BEDA MO (Hanya 1 folder yang ada, folder MO kedua belum ada terpisah):');
const pairs = [
  { name: 'Sadarin', rows: [328, 329], mos: ['M26326', 'M26327'], existingFolder: 'M26327 - Sadarin', missingMO: 'M26326' },
  { name: 'PT Sinergi Lintas Global', rows: [333, 334], mos: ['M26331', 'M26332'], existingFolder: 'M26331 - PT Sinergi Lintas Global', missingMO: 'M26332' },
  { name: 'Dewi suyenti', rows: [335, 336], mos: ['M26333', 'M26334'], existingFolder: 'M26333 - Dewi suyenti', missingMO: 'M26334' },
  { name: 'Jumadi', rows: [343, 345], mos: ['M26341', 'M26343'], existingFolder: 'M26343 - Jumadi', missingMO: 'M26341' },
  { name: 'Pribadi Nata Buana', rows: [344, 351], mos: ['M26342', 'M26349'], existingFolder: 'M26342 - Pribadi Nata Buana', missingMO: 'M26349' }
];
pairs.forEach(p => {
  console.log(`   - ${p.name}:`);
  console.log(`     * Folder yang ada di Drive: "${p.existingFolder}"`);
  console.log(`     * Folder MO kedua yang BELUM ADA di Drive: "${p.missingMO} - ${p.name}" (Row ${p.rows.find(r => sept2026.find(x => x.rowNumber === r).moCode === p.missingMO)})`);
});

// 3. Folders Missing Required Documents
const incompleteDocs = sept2026.filter(r => r.status !== 'LENGKAP' && r.status !== 'FOLDER_TIDAK_ADA');
console.log(`\n3. FOLDER ADA TAPI DOKUMEN BELUM LENGKAP (${incompleteDocs.length} deals):`);
incompleteDocs.forEach(r => {
  console.log(`   - Row ${r.rowNumber} | MO: ${r.moCode} | ${r.customer} | ${r.bank}`);
  console.log(`     Folder: ${r.folderName} (${r.folderUrl})`);
  console.log(`     Kekurangan: ${r.status === 'BELUM_ADA_SPA' ? 'Kurang SPA Signed PDF' : (r.status === 'BELUM_ADA_EMAIL_BANK' ? 'Kurang Konfirmasi Plafond / Email Bank' : r.status)}`);
  console.log(`     File yang sudah ada: ${r.filesList.join(', ')}`);
});

// 4. Completely Complete Folders
const complete = sept2026.filter(r => r.status === 'LENGKAP');
console.log(`\n4. FOLDER LENGKAP (Folder ada, SPA ada, Email Bank ada) (${complete.length} deals):`);
complete.forEach(r => {
  console.log(`   - Row ${r.rowNumber} | MO: ${r.moCode} | ${r.customer} | ${r.bank} | Folder: ${r.folderName}`);
});
