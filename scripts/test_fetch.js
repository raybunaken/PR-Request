const { fetchAllDeals } = require('../lib/sheets-client');

async function test() {
  console.log('Testing fetchAllDeals(agent)...');
  const agentDeals = await fetchAllDeals('agent');
  const noorAgent = agentDeals.find(d => d.customerName.toLowerCase().includes('noor') || d.customerName.toLowerCase().includes('ihsan'));
  console.log('Found in agentDeals?', noorAgent ? noorAgent.customerName : 'TIDAK ADA');

  console.log('\nTesting fetchAllDeals(all)...');
  const allDeals = await fetchAllDeals('all');
  const noorAll = allDeals.find(d => d.customerName.toLowerCase().includes('noor') || d.customerName.toLowerCase().includes('ihsan'));
  console.log('Found in allDeals?', noorAll ? noorAll.customerName : 'TIDAK ADA');
  if (noorAll) {
    console.log('Details in allDeals:', {
      row: noorAll.row,
      dbRow: noorAll.dbRow,
      customerName: noorAll.customerName,
      agentName: noorAll.agentName,
      percentage: noorAll.percentage,
      commission: noorAll.commission,
      grouping: noorAll.grouping,
      statusColK: noorAll.statusColK
    });
  }
}

// But sheets-client is typescript. Let's write a small node test that compiles or mimics it.
