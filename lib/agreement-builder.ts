import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';
import { DealItem } from './sheets-client';
import { 
  resolveAgent, 
  resolveR123BankAccount, 
  formatNumberIDR 
} from './kpr-config';

function formatTanggalIndonesia(val: any): string {
  if (!val) return '';
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  if (val instanceof Date) {
    return `${val.getDate()} ${months[val.getMonth()]} ${val.getFullYear()}`;
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return str;
}

export async function generateAgreementPdfBuffer(deal: DealItem): Promise<Buffer> {
  const agent = resolveAgent(deal.percentage);
  const entity = deal.entity; // 'WMI' | 'NND'

  const masterFilename = `Agreement_${agent.code}_${entity}.pdf`;
  const possiblePaths = [
    path.join(process.cwd(), 'master_agreements', masterFilename),
    path.join(process.cwd(), 'web', 'master_agreements', masterFilename),
    path.join(process.cwd(), '..', 'master_agreements', masterFilename)
  ];

  let masterPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      masterPath = p;
      break;
    }
  }

  if (!masterPath) {
    throw new Error(`Master agreement ${masterFilename} tidak ditemukan.`);
  }

  const masterBytes = fs.readFileSync(masterPath);
  const pdfDoc = await PDFDocument.load(masterBytes);

  const fontHelv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 1. Bersihkan Doc ID bertumpuk pada Halaman 1
  const p1 = pdfDoc.getPages()[0];
  p1.drawRectangle({
    x: 350.0,
    y: 841.9 - 840.0,
    width: 240.0,
    height: 20.0,
    color: rgb(1, 1, 1)
  });

  let docIdText = 'Doc ID: 59cb20b2f02774e3748806a7100b1997f7198b99';
  if (agent.name.includes('Irene')) {
    docIdText = (entity === 'WMI') ? 'Doc ID: 8e94dbbc2411cb4ca8656ca863e54db751d48110' : 'Doc ID: 430851cad216089a3efa5f7877eb3d527d926d7c';
  } else if (agent.name.includes('Juneth')) {
    docIdText = (entity === 'WMI') ? 'Doc ID: 56d0fd58c0af73ab6b446ed994055d04f1c5ed15' : 'Doc ID: 395e2eb2f39e6afbc26896303a145b86df65e7dc';
  } else if (entity === 'NND') {
    docIdText = 'Doc ID: 418979ec401a9d9cd5c276a597fb748a9b6d2b65';
  }

  p1.drawText(docIdText, {
    x: 358.6,
    y: 841.9 - 833.0,
    size: 8.87,
    font: fontHelv,
    color: rgb(0, 0, 0)
  });

  // 2. Buat Halaman 4 (Lampiran)
  const p4 = pdfDoc.addPage([595.3, 841.9]);

  // Logo 99 Group
  const logoPaths = [
    path.join(process.cwd(), 'public', 'logo_99group.png'),
    path.join(process.cwd(), 'web', 'public', 'logo_99group.png'),
    path.join(process.cwd(), '..', 'logo_99group.png'),
    path.join(process.cwd(), 'logo_99group.png')
  ];

  for (const lp of logoPaths) {
    if (fs.existsSync(lp)) {
      const logoBytes = fs.readFileSync(lp);
      const logoImg = await pdfDoc.embedPng(logoBytes);
      p4.drawImage(logoImg, {
        x: 69.2,
        y: 841.9 - 40.6 - 51.1,
        width: 171.4,
        height: 51.1
      });
      break;
    }
  }

  // Kop Alamat Kantor (Kanan Atas)
  const compName = (entity === 'WMI') ? 'PT Web Marketing Indonesia' : 'PT Ninety Nine Dotco';
  const RIGHT_MARGIN = 566.0;
  const headerLines = [
    { text: compName, color: rgb(0.16, 0.32, 0.51), size: 11.0 },
    { text: 'Level 37, Eightyeight Unit B-C,', color: rgb(0, 0, 0), size: 10.5 },
    { text: 'Kasablanka Jl, Casablanca,', color: rgb(0, 0, 0), size: 10.5 },
    { text: 'Menteng Dalam Jakarta 12870', color: rgb(0, 0, 0), size: 10.5 },
    { text: 'T: +62 2130-496-123', color: rgb(0, 0, 0), size: 10.5 }
  ];

  let yTop = 56.0;
  for (const h of headerLines) {
    const w = fontHelv.widthOfTextAtSize(h.text, h.size);
    p4.drawText(h.text, {
      x: RIGHT_MARGIN - w,
      y: 841.9 - yTop,
      size: h.size,
      font: fontHelv,
      color: h.color
    });
    yTop += 16.8;
  }

  // Judul LAMPIRAN
  const titleText = 'LAMPIRAN';
  const titleW = fontHelvBold.widthOfTextAtSize(titleText, 11.5);
  p4.drawText(titleText, {
    x: (595.3 - titleW) / 2,
    y: 841.9 - 148.0,
    size: 11.5,
    font: fontHelvBold,
    color: rgb(0, 0, 0)
  });

  // Bagian I: Detail Transaksi KPR
  p4.drawText('I. Detail Transaksi KPR', {
    x: 71.1,
    y: 841.9 - 185.0,
    size: 10.5,
    font: fontHelvBold,
    color: rgb(0, 0, 0)
  });

  const tglAkadStr = formatTanggalIndonesia(deal.tanggalAkad);
  const plafondStr = `Rp ${formatNumberIDR(deal.plafond || 0)}`;

  const sec1 = [
    ['Nama Nasabah', deal.customerName],
    ['Plafond', plafondStr],
    ['Tanggal Akad', tglAkadStr],
    ['Akad di Bank', deal.bank],
    ['Agent Referee', agent.name]
  ];

  let sec1Y = 212.0;
  for (const [k, v] of sec1) {
    p4.drawText(k, { x: 71.1, y: 841.9 - sec1Y, size: 10.0, font: fontHelv, color: rgb(0, 0, 0) });
    p4.drawText(':', { x: 175.0, y: 841.9 - sec1Y, size: 10.0, font: fontHelv, color: rgb(0, 0, 0) });
    p4.drawText(String(v || '-'), { x: 183.0, y: 841.9 - sec1Y, size: 10.0, font: fontHelv, color: rgb(0, 0, 0) });
    sec1Y += 15.0;
  }

  // Bagian II: Detail Pengiriman Referral Fee oleh Bank
  const sec2YStart = sec1Y + 24.0;
  p4.drawText('II. Detail Pengiriman Referral Fee oleh Bank', {
    x: 71.1,
    y: 841.9 - sec2YStart,
    size: 10.5,
    font: fontHelvBold,
    color: rgb(0, 0, 0)
  });

  const r123Acc = resolveR123BankAccount(deal.bank, entity, deal.r123AccountHint);
  const feeStr = `Rp ${formatNumberIDR(deal.targetAmount)}`;

  const sec2 = [
    ['Nama Bank', r123Acc.bank],
    ['Nomor Rekening', r123Acc.account],
    ['Atas Nama', r123Acc.name],
    ['Fee yang Dikirimkan', feeStr]
  ];

  let sec2Y = sec2YStart + 27.0;
  for (const [k, v] of sec2) {
    p4.drawText(k, { x: 71.1, y: 841.9 - sec2Y, size: 10.0, font: fontHelv, color: rgb(0, 0, 0) });
    p4.drawText(':', { x: 175.0, y: 841.9 - sec2Y, size: 10.0, font: fontHelv, color: rgb(0, 0, 0) });
    p4.drawText(String(v || '-'), { x: 183.0, y: 841.9 - sec2Y, size: 10.0, font: fontHelv, color: rgb(0, 0, 0) });
    sec2Y += 15.0;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
