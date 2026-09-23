# 99 Group - KPR Mortgage Operations Hub (Web Platform)

Platform web modern berbasis Next.js (App Router), React, dan Tailwind CSS untuk automasi operasional KPR:
1. **PR Request (.xlsx)** & **Agreement Komisi Agen (.pdf 4 Halaman)** ke Google Drive.
2. **Folder Leads Finance (SPA + Email Konfirmasi Bank)** di folder Google Drive `Leads Akad Automation`.

---

## Arsitektur 2 Tab

### Tab 1: PR Request & Agreement (Khusus Agent)
- Murni menampilkan transaksi yang memiliki komisi agen (bersih dari transaksi direct/Rp 0).
- Auto-combine transaksi BTN 2 baris (Appraisal 0.20% + Akad 0.80%).
- Potongan biaya transfer bank resmi Finance untuk bank terkait.
- Sekali klik *All-in-One*: Menghasilkan PR Request, Agreement PDF, dan sekaligus menghubungkan Folder Leads Finance di Google Drive.

### Tab 2: Folder Leads Finance (Semua Akad KPR)
- Menampilkan seluruh akad KPR (termasuk Direct Customer / Non-Agent).
- Memetakan kode unik `#MO` (contoh: `M26338`, `M26333`).
- Otomatis membuat dan menyinkronkan folder `[#MO] - [Nama Nasabah]` di Google Drive.
- Mendeteksi kelengkapan file `SPA_[Nama].pdf` dan `Konfirmasi Plafond - [Bank] - [Nama].pdf`.

---

## Environment Variables untuk Vercel

Tambahkan variabel berikut di dashboard **Vercel Settings ➔ Environment Variables**:

| Variable | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Stringified JSON dari Service Account Google Cloud | `{"type":"service_account",...}` |
| `SPREADSHEET_AKAD_ID` | Spreadsheet ID database utama `All - Akad Transaction` | `1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8` |
| `SPREADSHEET_CONTROLLER_ID` | Spreadsheet ID controller `Daftar Transaksi KPR` | `1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag` |
| `DRIVE_REFERRAL_FEE_FOLDER_ID` | Folder ID Google Drive untuk berkas PR & Agreement Agen | `1hlmmnsWDEVocTbMi3rWYWSh6zhu99VsM` |
| `DRIVE_FINANCE_LEADS_FOLDER_ID` | Folder ID Google Drive untuk arsip Leads Bukti Finance | `1KlCBYpZfk7vHyHqdcuUDiKo9RsRBpnJO` |
| `DRIVE_TEMPLATE_PR_ID` | File ID Google Spreadsheet template master PR Request | `1QlRwxUp9taMCfYLqwOxfEShTGGIX3Btat2GsI_GOqtQ` |

---

## Deployment ke Vercel

1. Buka [Vercel Dashboard](https://vercel.com/new).
2. Pilih repository GitHub: `raybunaken/PR-Request`.
3. Framework Preset otomatis mendeteksi **Next.js**.
4. Masukkan **Environment Variables** di atas.
5. Klik **Deploy**!
