'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Mail, 
  FileSpreadsheet, 
  ExternalLink, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  FolderOpen, 
  Database, 
  Sparkles, 
  Clock, 
  Users, 
  FileText, 
  Building2,
  ChevronRight
} from 'lucide-react';
import AppSwitcher from '@/components/AppSwitcher';

export default function PortalPage() {
  const apps = [
    {
      id: 'hub',
      name: 'Mortgage Intelligence Hub',
      role: 'Monitoring, Analitik & SLA Leads',
      category: 'Intelligence & Performance',
      url: 'https://kpr-hub.vercel.app/',
      isExternal: true,
      accentColor: 'from-sky-500 to-blue-600',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: <Activity className="w-6 h-6 text-sky-600" />,
      features: [
        'Daily Tele Scorecard untuk monitoring KPI harian tim Telemarketing',
        'Pipeline Summary untuk pelacakan tahapan pengajuan nasabah real-time',
        'Deteksi Stalled Leads untuk percepatan tindak lanjut berkas macet',
        'Pencarian data nasabah dan riwayat status pengajuan KPR'
      ],
      ctaText: 'Buka Intelligence Hub',
      ctaClass: 'bg-sky-600 hover:bg-sky-700 text-white'
    },
    {
      id: 'email',
      name: 'Email Generator KPR',
      role: 'Komunikasi & Korespondensi Bank',
      category: 'Communication Suite',
      url: 'https://email-generator-kpr-99.vercel.app/leads',
      isExternal: true,
      accentColor: 'from-purple-500 to-indigo-600',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <Mail className="w-6 h-6 text-purple-600" />,
      features: [
        'Generator template email PIC Bank otomatis berbasis data nasabah',
        'Notifikasi permohonan konfirmasi plafond dan berkas akad',
        'Format standar korespondensi operasional 99 Group',
        'Efisiensi follow-up leads dan bank rekanan tanpa ketik manual'
      ],
      ctaText: 'Buka Email Generator',
      ctaClass: 'bg-purple-600 hover:bg-purple-700 text-white'
    },
    {
      id: 'pr',
      name: 'PR Request & Leads Automation',
      role: 'Keuangan, Agreement & Arsip Dokumen',
      category: 'Finance & Workflow',
      url: '/',
      isExternal: false,
      accentColor: 'from-emerald-500 to-teal-600',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <FileSpreadsheet className="w-6 h-6 text-emerald-600" />,
      features: [
        'Otomasi pembuatan spreadsheet Payment Requisition (PR) Referral Fee Agent',
        'Generator Agreement Pembagian Komisi Agen (4 Halaman PDF resmi)',
        'Pembuatan otomatis Folder Leads Finance di Google Drive',
        'Penarikan cerdas berkas SPA signed & PDF konfirmasi bank dari Gmail'
      ],
      ctaText: 'Buka Otomasi PR & Leads',
      ctaClass: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    }
  ];

  const quickResources = [
    {
      title: 'Google Drive - Leads Akad Automation',
      desc: 'Folder arsip berkas SPA Signed dan Konfirmasi Bank per nasabah',
      url: 'https://drive.google.com/drive/folders/1KlCBYpZfk7vHyHqdcuUDiKo9RsRBpnJO',
      icon: <FolderOpen className="w-4 h-4 text-amber-600" />
    },
    {
      title: 'Google Drive - Referral Fee Agent',
      desc: 'Folder dokumen PR Request Excel dan Agreement PDF per agen',
      url: 'https://drive.google.com/drive/folders/1hlmmnsWDEVocTbMi3rWYWSh6zhu99VsM',
      icon: <FolderOpen className="w-4 h-4 text-blue-600" />
    },
    {
      title: 'Database Utama - All Akad Transaction',
      desc: 'Master spreadsheet database transaksi akad KPR 99 Group',
      url: 'https://docs.google.com/spreadsheets/d/1ahgBUNp3m0tWXVAnQjDmbMZexP05VI36bmE0xjTqNE8',
      icon: <Database className="w-4 h-4 text-emerald-600" />
    },
    {
      title: 'Controller Sheet - Daftar Transaksi KPR',
      desc: 'Spreadsheet pengontrol status PR Request dan tautan dokumen',
      url: 'https://docs.google.com/spreadsheets/d/1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag',
      icon: <Database className="w-4 h-4 text-indigo-600" />
    }
  ];

  const workflows = [
    {
      step: '01',
      title: 'Monitoring Leads',
      tool: 'Mortgage Intelligence Hub',
      desc: 'Pantau status scorecard telemarketing, tahapan SLA, dan stalled leads secara harian.'
    },
    {
      step: '02',
      title: 'Korespondensi Bank',
      tool: 'Email Generator KPR',
      desc: 'Kirimkan draf email standar untuk konfirmasi plafond, kelengkapan berkas, dan follow-up PIC Bank.'
    },
    {
      step: '03',
      title: 'Otomasi PR & Agreement',
      tool: 'PR Request Automation',
      desc: 'Saat nasabah akad, buat berkas PR Request Excel dan dokumen Agreement komisi agen 4 halaman utuh.'
    },
    {
      step: '04',
      title: 'Arsip Folder & Verifikasi',
      tool: 'Leads Folder & Gmail Fetcher',
      desc: 'Sinkronkan Folder Leads di Drive, tarik otomatis SPA signed dan PDF konfirmasi email bank dari Gmail.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              99
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">
                  99 Group &bull; KPR Operations Command Center
                </h1>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Portal Ops
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pusat Kontrol Terpadu Seluruh Alat &amp; Otomasi Operasional KPR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AppSwitcher currentApp="portal" />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              <span>Buka Otomasi PR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-10 shadow-lg border border-slate-800 relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Satu Pintu Akses Ekosistem Operasional KPR</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Pusat Kendali Operasional KPR 99 Group
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mt-2.5 leading-relaxed">
              Semua modul kerja tim Operasional (Ops) kini dapat diakses dalam satu halaman portal. 
              Mulai dari intelijen performa telemarketing, pembuatan draf email PIC bank, hingga otomasi pembayaran komisi agen dan pengarsipan folder finance.
            </p>

            <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-700/60 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-200">3 Modul Aktif &amp; Terintegrasi</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-200">Google Drive &amp; Sheets Connected</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-200">Gmail Automated Fetching</span>
              </div>
            </div>
          </div>

          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-600/10 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Main Apps Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Aplikasi Utama Operasional KPR</h3>
            <p className="text-xs text-slate-500">Pilih aplikasi yang ingin Anda buka atau gunakan</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200/80 text-slate-700">
            3 Layanan Siap Pakai
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
            >
              <div>
                {/* Card Top Accent */}
                <div className={`h-2 bg-gradient-to-r ${app.accentColor}`} />

                <div className="p-6">
                  {/* Category & Status */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${app.badgeBg}`}>
                      {app.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Online</span>
                    </span>
                  </div>

                  {/* Title & Icon */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-105 transition-transform duration-200 shrink-0">
                      {app.icon}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {app.name}
                      </h4>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        {app.role}
                      </p>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Fitur &amp; Kegunaan:
                    </div>
                    {app.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Action Button */}
              <div className="p-6 pt-0">
                {app.isExternal ? (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${app.ctaClass}`}
                  >
                    <span>{app.ctaText}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link
                    href={app.url}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${app.ctaClass}`}
                  >
                    <span>{app.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="max-w-2xl mb-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Alur Standar Operasional KPR (Ops Lifecycle Workflow)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Panduan integrasi alur kerja end-to-end dari kualifikasi awal leads sampai pembayaran komisi dan pengarsipan bukti finance
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {workflows.map((wf, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl font-black text-slate-300 font-mono">
                      {wf.step}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {wf.tool}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">
                    {wf.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {wf.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Resources Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Akses Cepat Database &amp; Penyimpanan Drive
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Tautan langsung ke Google Drive dan Google Sheets yang digunakan dalam seluruh proses otomasi
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickResources.map((res, idx) => (
              <a
                key={idx}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all no-underline group"
              >
                <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-blue-100 transition-colors shrink-0">
                  {res.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h5 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">
                      {res.title}
                    </h5>
                    <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {res.desc}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
