const fs = require('fs');
const path = require('path');

const res = JSON.parse(fs.readFileSync(path.join(__dirname, 'september_audit_results.json'), 'utf8'));

console.log('=== MULTI-MO DEALS (SAME CUSTOMER, DIFFERENT MO) ===');
res.multiMODeals.forEach((group, idx) => {
  console.log(`\nGroup ${idx + 1}: Customer "${group[0].customer}" (${group.length} deals)`);
  group.forEach(d => {
    // find matched result
    const r = res.results.find(x => x.rowNumber === d.rowNumber);
    console.log(`  Row ${d.rowNumber}: MO: "${d.moCode || '(KOSONG)'}", Bank: ${d.bank}, Plafond: ${d.plafond}`);
    console.log(`    Status Folder: ${r.status}, Folder Name: "${r.folderName || 'TIDAK ADA'}"`);
    console.log(`    Files (${r.fileCount}): ${r.filesList.join(', ') || 'None'}`);
    console.log(`    Col Leads Sheet: "${d.leadsFolderCol || '(KOSONG)'}"`);
  });
});

console.log('\n======================================================');
console.log('=== ALL DEALS WITH FOLDER_TIDAK_ADA (MISSING FOLDER) ===');
const missing = res.results.filter(r => r.status === 'FOLDER_TIDAK_ADA');
console.log(`Total: ${missing.length}`);
missing.forEach(r => {
  console.log(`- Row ${r.rowNumber} | ${r.customer} | MO: "${r.moCode || '-'}" | Bank: ${r.bank} | Tgl: ${r.tglAkad} | Col Leads: "${r.leadsFolderCol || '-'}"`);
});

console.log('\n======================================================');
console.log('=== ALL DEALS WITH INCOMPLETE FOLDER (MISSING SPA / BANK EMAIL) ===');
const incomplete = res.results.filter(r => r.status !== 'LENGKAP' && r.status !== 'FOLDER_TIDAK_ADA');
console.log(`Total: ${incomplete.length}`);
incomplete.forEach(r => {
  console.log(`- Row ${r.rowNumber} | ${r.customer} | MO: "${r.moCode || '-'}" | Bank: ${r.bank} | Status: ${r.status}`);
  console.log(`  Folder: ${r.folderName} (${r.folderUrl})`);
  console.log(`  Files in folder: ${r.filesList.join(', ')}`);
});

console.log('\n======================================================');
console.log('=== ALL DEALS WITH COMPLETE FOLDER ===');
const complete = res.results.filter(r => r.status === 'LENGKAP');
console.log(`Total: ${complete.length}`);
complete.forEach(r => {
  console.log(`- Row ${r.rowNumber} | ${r.customer} | MO: "${r.moCode || '-'}" | Bank: ${r.bank} | Folder: ${r.folderName}`);
});
