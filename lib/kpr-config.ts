export interface AgentConfig {
  code: string;
  name: string;
  payeeName: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface BankAccountInfo {
  bank: string;
  account: string;
  name: string;
}

export const KPR_CONFIG = {
  // Spreadsheet IDs
  AKAD_SPREADSHEET_ID: process.env.SPREADSHEET_AKAD_ID || '1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8',
  CONTROLLER_SPREADSHEET_ID: process.env.SPREADSHEET_CONTROLLER_ID || '1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag',

  // Google Drive Config
  REFERRAL_FEE_AGENT_FOLDER_ID: process.env.DRIVE_REFERRAL_FEE_FOLDER_ID || '1hlmmnsWDEVocTbMi3rWYWSh6zhu99VsM',
  FINANCE_LEADS_ROOT_FOLDER_ID: process.env.DRIVE_FINANCE_LEADS_FOLDER_ID || '1KlCBYpZfk7vHyHqdcuUDiKo9RsRBpnJO',
  TEMPLATE_PR_ID: process.env.DRIVE_TEMPLATE_PR_ID || '1QlRwxUp9taMCfYLqwOxfEShTGGIX3Btat2GsI_GOqtQ',
  SERVICE_ACCOUNT_EMAIL: 'robot-kpr@kpr-automation.iam.gserviceaccount.com',

  // Master Metadata
  REQUESTER_NAME: 'Fransisca Octarina',
  REQUESTER_DEPT: 'CEO Team',
  APPROVER_BU_HEAD: 'Cheung Yik',

  // 3 Master Data Agen Aktif
  AGENTS: {
    85: {
      code: 'Irene',
      name: 'Irene Dyah Rhespati',
      payeeName: 'Irene Dyah Respati',
      bankName: 'BCA',
      accountNumber: '6565190826',
      accountName: 'Irene Dyah Respati'
    },
    90: {
      code: 'Sudiyono',
      name: 'Sudiyono',
      payeeName: 'Sudiyono',
      bankName: 'Hana Bank',
      accountNumber: '10526119630',
      accountName: 'Sudiyono'
    },
    80: {
      code: 'Juneth',
      name: 'Juneth Andriani',
      payeeName: 'Juneth Andriani',
      bankName: 'BCA',
      accountNumber: '6871960868',
      accountName: 'Juneth Andriani'
    }
  } as Record<number, AgentConfig>,

  // Pemetaan Bank ke Entitas PT (NND vs WMI)
  BANK_ENTITY_MAP: {
    'danamon': 'PT. Ninety Nine Dotco',
    'uob': 'PT. Ninety Nine Dotco',
    'maybank': 'PT. Ninety Nine Dotco',
    'permata': 'PT. Ninety Nine Dotco',
    'ina': 'PT. Ninety Nine Dotco',
    'mandiri': 'PT. Web Marketing Indonesia',
    'bsi': 'PT. Web Marketing Indonesia',
    'cimb': 'PT. Web Marketing Indonesia',
    'btn': 'PT. Web Marketing Indonesia',
    'muamalat': 'PT. Web Marketing Indonesia',
    'bukopin': 'PT. Web Marketing Indonesia',
    'ringkas': 'PT. Web Marketing Indonesia',
    'ganesha': 'PT. Web Marketing Indonesia'
  } as Record<string, string>,

  // Master Data Rekening Perusahaan R123
  R123_ACCOUNTS: {
    NND: {
      bca: { bank: 'BCA', account: '4973868899', name: 'PT NINETY NINE DOTCO' },
      mandiri: { bank: 'Mandiri', account: '0700007275782', name: 'PT NINETY NINE DOTCO' },
      ocbc: { bank: 'OCBC', account: '545800081410', name: 'PT NINETY NINE DOTCO' },
      danamon: { bank: 'Danamon', account: '3628633806', name: 'PT NINETY NINE DOTCO' },
      bukopin: { bank: 'Bukopin Syariah', account: '8802803100', name: 'PT NINETY NINE DOTCO' },
      dbs: { bank: 'DBS', account: '208450385', name: 'PT NINETY NINE DOTCO' },
      dki: { bank: 'Bank DKI', account: '11108082091', name: 'PT NINETY NINE DOTCO' },
      maybank: { bank: 'Maybank', account: '2145000339', name: 'PT NINETY NINE DOTCO' },
      default: { bank: 'BCA', account: '4973868899', name: 'PT NINETY NINE DOTCO' }
    } as Record<string, BankAccountInfo>,
    WMI: {
      mandiri: { bank: 'Mandiri', account: '0060088010123', name: 'PT WEB MARKETING INDONESIA' },
      cimb: { bank: 'CIMB Niaga', account: '800195457000', name: 'WEB MARKETING INDONESIA' },
      bsi: { bank: 'BSI', account: '7303174286', name: 'WEB MARKETING ID' },
      ocbc: { bank: 'OCBC', account: '545800075412', name: 'PT. WEB MARKETING INDONESIA' },
      bca: { bank: 'BCA', account: '0063137500', name: 'WEB MARKETING INDONESIA PT' },
      bni: { bank: 'BNI Konvensional', account: '1238765123', name: 'PT. WEB MARKETING INDONESIA' },
      btn: { bank: 'BTN', account: '24101300012569', name: 'WEB MARKETING INDONESIA' },
      bri: { bank: 'BRI', account: '113001000605305', name: 'PT WEB MARKETING INDONESIA' },
      dbs: { bank: 'DBS', account: '208455384', name: 'WEB MARKETING INDONESIA PT' },
      default: { bank: 'CIMB Niaga', account: '800195457000', name: 'WEB MARKETING INDONESIA' }
    } as Record<string, BankAccountInfo>
  }
};

export function getCompanyByBank(bankName: string): string {
  const norm = String(bankName || '').toLowerCase();
  for (const [key, comp] of Object.entries(KPR_CONFIG.BANK_ENTITY_MAP)) {
    if (norm.includes(key)) return comp;
  }
  return 'PT. Web Marketing Indonesia';
}

export function getEntityCodeByBank(bankName: string): 'NND' | 'WMI' {
  const comp = getCompanyByBank(bankName);
  return comp.includes('Ninety Nine') ? 'NND' : 'WMI';
}

export function resolveAgent(percentageVal: any, agentNameHint?: string): AgentConfig {
  if (agentNameHint) {
    const hint = agentNameHint.toLowerCase();
    if (hint.includes('sudiyono')) return KPR_CONFIG.AGENTS[90];
    if (hint.includes('juneth')) return KPR_CONFIG.AGENTS[80];
    if (hint.includes('irene') || hint.includes('respati')) return KPR_CONFIG.AGENTS[85];
  }

  const str = String(percentageVal || '').replace('%', '').trim();
  let num = parseFloat(str);
  if (isNaN(num)) return KPR_CONFIG.AGENTS[85];
  if (num > 0 && num <= 1) {
    num = Math.round(num * 100);
  } else {
    num = Math.round(num);
  }

  if (num === 90) return KPR_CONFIG.AGENTS[90];
  if (num === 80) return KPR_CONFIG.AGENTS[80];
  return KPR_CONFIG.AGENTS[85];
}

export function resolveR123BankAccount(bankName: string, entityCode: 'NND' | 'WMI', hintColM?: string): BankAccountInfo {
  const accounts = KPR_CONFIG.R123_ACCOUNTS[entityCode] || KPR_CONFIG.R123_ACCOUNTS.WMI;
  const hint = String(hintColM || '').toLowerCase();
  const bank = String(bankName || '').toLowerCase();

  if (hint.includes('ocbc')) return accounts.ocbc || accounts.default;
  if (hint.includes('bca')) return accounts.bca || accounts.default;
  if (hint.includes('cimb')) return accounts.cimb || accounts.default;
  if (hint.includes('mandiri')) return accounts.mandiri || accounts.default;
  if (hint.includes('bsi')) return accounts.bsi || accounts.default;
  if (hint.includes('btn')) return accounts.btn || accounts.default;
  if (hint.includes('danamon')) return accounts.danamon || accounts.default;

  for (const key of Object.keys(accounts)) {
    if (bank.includes(key)) return accounts[key];
  }
  return accounts.default;
}

export function parseNumberClean(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  if (!val) return 0;
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleanStr);
  return isNaN(n) ? 0 : Math.round(n);
}

export function formatCurrencyIDR(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0);
}

export function formatNumberIDR(val: number): string {
  return new Intl.NumberFormat('id-ID').format(val || 0);
}
