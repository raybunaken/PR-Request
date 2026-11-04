const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'september_audit_raw.json'), 'utf8'));
const res = JSON.parse(fs.readFileSync(path.join(__dirname, 'september_audit_results.json'), 'utf8'));

// Filter only September 2026 (Rows 328 to 352)
const sept2026Results = res.results.filter(r => r.rowNumber >= 328 && r.rowNumber <= 352);

console.log(`Auditing ${sept2026Results.length} September 2026 deals:`);

sept2026Results.forEach(r => {
  console.log(`\nRow ${r.rowNumber}: ${r.customer} | MO: ${r.moCode} | Bank: ${r.bank} | Tgl: ${r.tglAkad}`);
  console.log(`  Folder Status: ${r.status}`);
  console.log(`  Folder Name in Drive: ${r.folderName || 'TIDAK DITEMUKAN'}`);
  console.log(`  Folder URL in Drive: ${r.folderUrl || '-'}`);
  console.log(`  Folder in Sheet Col X: ${r.leadsFolderCol || '(KOSONG)'}`);
  console.log(`  Files (${r.fileCount}): ${r.filesList.join(', ') || 'KOSONG'}`);
  console.log(`  SPA: ${r.hasSpa ? 'ADA (' + r.spaFileName + ')' : 'BELUM ADA'}`);
  console.log(`  Bank Email: ${r.hasBankEmail ? 'ADA (' + r.bankEmailFileName + ')' : 'BELUM ADA'}`);
});
