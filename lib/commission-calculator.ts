import { parseNumberClean } from './kpr-config';

export function normalizeName(str: string): string {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface SmartCommissionResult {
  amount: number;
  isEstimated: boolean;
}

export function calculateSmartCommission(rowValues: any[]): SmartCommissionResult {
  // Index Kolom Database 'All - Akad Transaction':
  // G (index 6): Plafond GMV
  // J (index 9): % Komisi Bank
  // K (index 10): Gross Bank Commission
  // P (index 15): Net Payment Bank
  // R (index 17): Agent % Commission
  // S (index 18): Agent Commission (IDR)
  
  const existingComm = parseNumberClean(rowValues[18]);

  // Parse % Komisi Agent (Kolom R)
  let pctVal = 0;
  const pctRaw = rowValues[17];
  if (typeof pctRaw === 'number') {
    pctVal = pctRaw;
  } else if (typeof pctRaw === 'string') {
    pctVal = parseNumberClean(pctRaw) / 100;
  }

  // 1. Coba dari Gross Bank Comm (Kolom K)
  let grossBankComm = parseNumberClean(rowValues[10]);

  // 2. Jika Gross kosong, coba dari Plafond (Kolom G) * % Bank (Kolom J)
  if (grossBankComm <= 0) {
    const plafond = parseNumberClean(rowValues[6]);
    let bankPct = 0;
    const bankPctRaw = rowValues[9];
    if (typeof bankPctRaw === 'number') bankPct = bankPctRaw;
    else if (typeof bankPctRaw === 'string') bankPct = parseNumberClean(bankPctRaw) / 100;

    if (plafond > 0 && bankPct > 0) {
      grossBankComm = plafond * bankPct;
    }
  }

  let finalAmount = existingComm;
  let isEstimated = false;

  if (finalAmount <= 0) {
    if (grossBankComm > 0 && pctVal > 0) {
      // Formula resmi database: Gross * 98% (potong PPh 23 2%) * %Agent
      const netPaymentBankEst = grossBankComm * 0.98;
      finalAmount = Math.round(netPaymentBankEst * pctVal);
      isEstimated = true;
    }
  }

  // ATURAN RESMI FINANCE: Potongan Biaya Transfer Bank (Bank Fee Rp 2.900 per transaksi)
  // Dibebankan proporsional ke Agen: Bank Fee * % Agen
  if (finalAmount > 0 && pctVal > 0) {
    const bankName = String(rowValues[5] || '').toLowerCase();
    const custName = normalizeName(rowValues[1] || '');
    
    // Bank yang membebankan biaya transfer antar-bank ke rekening penampung kita (Danamon, INA, Bukopin, UOB)
    if (bankName.includes('danamon') || bankName.includes('ina') || bankName.includes('bukopin') || bankName.includes('uob')) {
      // Dewi Suyenti: 2 transaksi (Takeover + Topup) -> 2 x Rp 2.900 = Rp 5.800 * 90% = Rp 5.220
      const numTrx = custName.includes('dewi suyenti') ? 2 : 1;
      const bankFeeDeduction = Math.round(numTrx * 2900 * pctVal);
      finalAmount = finalAmount - bankFeeDeduction;
    }
  }

  return {
    amount: finalAmount > 0 ? finalAmount : 0,
    isEstimated
  };
}

export function combineBTNTransactions(
  dealData: any,
  allDbRows: any[][]
): { dealData: any; partnerDbRow: number | null } {
  if (!dealData.bankName || !dealData.bankName.toLowerCase().includes('btn')) {
    return { dealData, partnerDbRow: null };
  }

  const custNorm = normalizeName(dealData.customerName);
  let partnerDbRow: number | null = null;
  let partnerRaw: any[] | null = null;

  for (let i = allDbRows.length - 1; i >= 1; i--) {
    const rowNum = i + 1;
    if (rowNum === dealData.dbRow) continue;

    const r = allDbRows[i];
    const rCust = normalizeName(r[1]);
    const rBank = String(r[5] || '').toLowerCase();

    if (rCust === custNorm && rBank.includes('btn')) {
      partnerDbRow = rowNum;
      partnerRaw = r;
      break;
    }
  }

  if (!partnerRaw) {
    return { dealData, partnerDbRow: null };
  }

  const currentComm = calculateSmartCommission(allDbRows[dealData.dbRow - 1]);
  const partnerComm = calculateSmartCommission(partnerRaw);

  const currentPlafond = parseNumberClean(dealData.plafond);
  const partnerPlafond = parseNumberClean(partnerRaw[6]);
  const combinedPlafond = Math.max(currentPlafond, partnerPlafond);

  let combinedCommission = currentComm.amount + partnerComm.amount;
  if (custNorm.includes('yulia')) {
    combinedCommission = 33200954; // Angka approval Finance Vidie Revi Agustin
  } else if (custNorm.includes('erik') || custNorm.includes('erick')) {
    combinedCommission = 4713514;  // Angka approval Finance Vidie Revi Agustin
  }

  let officialTglAkad = dealData.tanggalAkad;
  if (partnerRaw[4]) {
    try {
      const d1 = new Date(dealData.tanggalAkad);
      const d2 = new Date(partnerRaw[4]);
      if (d2 > d1) officialTglAkad = partnerRaw[4];
    } catch {
      officialTglAkad = partnerRaw[4];
    }
  }

  return {
    dealData: {
      ...dealData,
      plafond: combinedPlafond,
      commissionAmount: combinedCommission,
      tanggalAkad: officialTglAkad,
      isBtnCombined: true,
      partnerDbRow
    },
    partnerDbRow
  };
}
