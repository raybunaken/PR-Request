# AI Agent Context & Guidelines - PR Request & Leads Automation

## 1. Project Overview & Ecosystem
This repository (`PR-Request`) is part of the **99 Group KPR Operations Suite**.

The ecosystem consists of 4 synchronized operational tools:
1. **PR Request & Leads Automation** (This project)
   - Local path: `d:\Automasi PR Request\web`
   - Production URL: `https://pr-request.vercel.app/`
   - Purpose: Automated PR Excel generation, agent fee agreements (PDF), and Google Drive lead folders synchronization.
2. **Operations Command Center Launchpad (Central Portal)**
   - Production URL: `https://pr-request.vercel.app/portal`
   - Purpose: Centralized launchpad and operational hub for the KPR Ops team. Contains direct cards to all tools, 4-stage operational lifecycle, and direct links to Drive/Sheets.
3. **Mortgage Intelligence Hub**
   - Local path: `D:\Big data Kpr`
   - Production URL: `https://kpr-hub.vercel.app/`
   - Purpose: Daily telesales scorecard, SLA follow-up monitoring, acquisition analytics, and CRM pipeline tracking.
4. **Email Generator KPR**
   - Local path: `D:\Product tim sales`
   - Production URL: `https://email-generator-kpr-99.vercel.app/leads`
   - Purpose: Draft bank submission emails and notify PIC bank contacts.

---

## 2. Strict Operational Rules
1. **100% Web Application Flow**:
   - All PR generation, Agreement PDF generation, and Google Drive syncing are executed through the **Web App** (`https://pr-request.vercel.app/`).
   - NEVER suggest or use Google Sheets Apps Script menus to generate files.
2. **Communication Constraints**:
   - Zero emojis across all communication.
   - Zero m-dashes (no em-dash or double-dash).
   - Use clickable markdown links for all URLs and file references.

---

## 3. Master Data: 4 Active Agents
Only the following 4 agents are active. All other agents in the database are considered inactive:
1. **Sudiyono (90%)**:
   - Payee: Sudiyono
   - Bank: Hana Bank
   - Account: `10526119630`
2. **Irene Dyah Rhespati (85%)**:
   - Payee: Irene Dyah Respati
   - Bank: BCA
   - Account: `6565190826` (or `5220306124`)
3. **Juneth Andriani (80%)**:
   - Payee: Juneth Andriani
   - Bank: BCA
   - Account: `6871960868`
4. **Sarahati Br Tarigan (50%)**:
   - Payee: Sarahati Br Tarigan
   - Bank: BCA
   - Account: `5255441105`

---

## 4. Commission & Bank Fee Calculation Rules
1. **Bank Muamalat (DPP Tax Withholding)**:
   - DPP = Gross Bank Commission / 1.11 (net of 11% PPN).
   - PPh 23 (2%) = DPP * 0.02.
   - Net received from Muamalat = Gross Bank Commission - PPh 23.
   - Agent Commission = Net received * % Agent.
   - Example (Raihan qodri, Gross Rp 2.250.000, 50%): Net = Rp 2.209.459,46 -> Agent = Rp 1.104.730.
2. **Bank Danamon (Transfer Fee Deductions)**:
   - Standard bank transfer fee: Rp 2.900 per transaction, charged proportionally to agent (Rp 2.900 * % Agent = Rp 2.610 for 90%).
   - Takeover transactions (e.g. Septa Afrian Nandoe, Dewi Suyenti, Andre Wilson Siregar): Charged **2x transfer fee** (2 * Rp 2.900 * % Agent = Rp 5.220 for 90%).
3. **BTN Combined Transactions**:
   - Takeover + Topup transactions on the same customer are combined into a single PR with the sum of amounts.

---

## 5. Master IDs & Google Drive Configuration
- **Controller Spreadsheet**: `1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag` (Tab: `Daftar Transaksi KPR`)
- **Master Akad Database**: `1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8` (Tab: `All - Akad Transaction`)
- **Referral Fee Agents Root Folder**: `1hlmmnsWDEVocTbMi3rWYWSh6zhu99VsM`
- **Finance Leads Root Folder**: `1KlCBYpZfk7vHyHqdcuUDiKo9RsRBpnJO`
- **PR Template Spreadsheet**: `1QlRwxUp9taMCfYLqwOxfEShTGGIX3Btat2GsI_GOqtQ`

---

## 6. Tech Stack & Deployment
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: `lucide-react`
- **Build**: `npm run build` (inside `web/`)
- **Dev**: `npm run dev` (inside `web/`)
- **Vercel Deploy**: `npx vercel --prod --yes --scope rayssas-projects-8ce61970` (inside `web/`)
