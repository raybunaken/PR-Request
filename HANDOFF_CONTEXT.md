# Handoff Context & Antigravity Migration Guide

Dokumen ini dibuat khusus untuk memindahkan seluruh workspace, kredensial, dan konteks kerja Antigravity ke laptop baru secara instan dan utuh.

---

## 1. File Penting yang Harus Ada di Laptop Baru
Folder utama proyek: `D:\Automasi PR Request` (atau path baru di laptop baru).
Pastikan file-file berikut ikut terpindahkan:
1. `web/.env.local` (Kredensial environment Next.js)
2. `web/kpr-automation.json` (Service account Google API)
3. `kpr-automation-d9769f696b12.json` (Service account root)
4. `master_agreements/` (Template master PDF PKS agen untuk WMI dan NND)
5. `web/master_agreements/` (Copy template master PDF)
6. `AGENTS.md` (Panduan dan aturan baku AI Antigravity)

---

## 2. Cara Menjalankan di Antigravity Laptop Baru
1. **Buka Folder di Antigravity**:
   Buka Antigravity di laptop baru, lalu buka folder workspace `Automasi PR Request`.
2. **Antigravity Otomatis Mengenali Konteks**:
   Karena file `AGENTS.md` berada di root folder, Antigravity akan langsung otomatis membaca seluruh aturan operasional, 4 agen aktif, formula pajak/fee bank, dan link Google Drive/Sheets.
3. **Install Dependencies**:
   Buka terminal di dalam folder `web`:
   ```bash
   cd web
   npm install
   ```
4. **Deploy ke Vercel (Jika Diperlukan)**:
   ```bash
   npx vercel --prod --yes --scope rayssas-projects-8ce61970
   ```

---

## 3. Konfigurasi MCP Server (Mortgage Intelligence)
Jika menggunakan MCP server `kpr-intelligence` di laptop baru:
Copy folder MCP dari:
`C:\Users\<UserLama>\.gemini\antigravity\mcp`
ke:
`C:\Users\<UserBaru>\.gemini\antigravity\mcp`

---

## 4. Ringkasan Status Terakhir Proyek
1. **Sarahati Br Tarigan (50%)**:
   - Nominal PR: **Rp 1.104.730** (a.n. Raihan qodri, Bank Muamalat)
   - Status: SINKRON, PR Spreadsheet dan Agreement PDF sudah dibuat dan cocok dengan mutasi resmi Finance.
2. **Sudiyono (90%)**:
   - Nominal PR: **Rp 6.043.842** (a.n. Septa Afrian Nandoe, Bank Danamon)
   - Status: SINKRON, PR Spreadsheet dan Agreement PDF sudah disesuaikan dengan potongan 2x Danamon fee.
3. **Alur Kerja**:
   - 100% menggunakan Web App di [pr-request.vercel.app](https://pr-request.vercel.app/).
