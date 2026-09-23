import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { DealItem } from './sheets-client';
import { KPR_CONFIG, resolveAgent } from './kpr-config';

export async function generatePRExcelBuffer(deal: DealItem): Promise<Buffer> {
  const possiblePaths = [
    path.join(process.cwd(), 'templates', 'template_pr.xlsx'),
    path.join(process.cwd(), 'web', 'templates', 'template_pr.xlsx'),
    path.join(process.cwd(), '..', 'template_pr.xlsx'),
    path.join(process.cwd(), 'template_pr.xlsx')
  ];

  let templatePath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      templatePath = p;
      break;
    }
  }

  if (!templatePath) {
    throw new Error('Template template_pr.xlsx tidak ditemukan di direktori.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];

  const agent = resolveAgent(deal.percentage);
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`;

  // Set cells
  worksheet.getCell('G11').value = dateStr;
  worksheet.getCell('D12').value = deal.company;
  worksheet.getCell('D13').value = KPR_CONFIG.REQUESTER_NAME;
  worksheet.getCell('D14').value = KPR_CONFIG.REQUESTER_DEPT;
  worksheet.getCell('D15').value = `Referral Fee Agent ${agent.payeeName}`;
  worksheet.getCell('D17').value = agent.payeeName;
  worksheet.getCell('D19').value = agent.bankName;
  worksheet.getCell('D20').value = agent.accountNumber;
  worksheet.getCell('D21').value = agent.accountName;
  worksheet.getCell('D22').value = deal.targetAmount;

  worksheet.getCell('C25').value = `Mortgage - Agent transaction\nCommission sharing a.n. ${deal.customerName}`;
  worksheet.getCell('F25').value = 'Cost Mortgage - Agent Transaction';
  worksheet.getCell('G25').value = { formula: '=D22', result: deal.targetAmount };
  worksheet.getCell('G32').value = { formula: '=G25', result: deal.targetAmount };

  worksheet.getCell('D34').value = deal.customerName;
  worksheet.getCell('B38').value = KPR_CONFIG.REQUESTER_NAME;
  worksheet.getCell('D38').value = KPR_CONFIG.APPROVER_BU_HEAD;

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
