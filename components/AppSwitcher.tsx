'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Grid, 
  ExternalLink, 
  Activity, 
  Mail, 
  FileSpreadsheet, 
  Compass, 
  ChevronDown, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

interface AppItem {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  isExternal: boolean;
  isActive?: boolean;
  category: string;
  icon: React.ReactNode;
  badge?: string;
  colorClass: string;
}

export default function AppSwitcher({ currentApp = 'pr' }: { currentApp?: 'pr' | 'hub' | 'email' | 'portal' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const apps: AppItem[] = [
    {
      id: 'hub',
      name: 'Mortgage Intelligence Hub',
      subtitle: 'Tele scorecard harian, pipeline summary & SLA',
      url: 'https://kpr-hub.vercel.app/',
      isExternal: true,
      isActive: currentApp === 'hub',
      category: 'Intelligence & Analytics',
      icon: <Activity className="w-5 h-5 text-sky-600" />,
      colorClass: 'bg-sky-50 text-sky-700 border-sky-200'
    },
    {
      id: 'email',
      name: 'Email Generator KPR',
      subtitle: 'Generator template email bank & notifikasi leads',
      url: 'https://email-generator-kpr-99.vercel.app/leads',
      isExternal: true,
      isActive: currentApp === 'email',
      category: 'Komunikasi & Email',
      icon: <Mail className="w-5 h-5 text-purple-600" />,
      colorClass: 'bg-purple-50 text-purple-700 border-purple-200'
    },
    {
      id: 'pr',
      name: 'PR Request & Leads Automation',
      subtitle: 'PR Excel, Agreement PDF agen & folder Leads Drive',
      url: '/',
      isExternal: false,
      isActive: currentApp === 'pr',
      category: 'Keuangan & Dokumen',
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
      badge: 'Aktif',
      colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  ];

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition-all shadow-xs"
        aria-expanded={isOpen}
      >
        <Grid className="w-3.5 h-3.5 text-blue-600" />
        <span className="font-medium">KPR Ops Suite</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-500 text-white flex items-center justify-center font-black text-xs">
                99
              </div>
              <span className="text-xs font-bold tracking-tight">KPR Operations Suite</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              3 Modul
            </span>
          </div>

          {/* List of Apps */}
          <div className="p-2 space-y-1 bg-white">
            {apps.map((app) => {
              const content = (
                <div
                  className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                    app.isActive
                      ? 'bg-blue-50/70 border border-blue-200/80'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <div className={`p-2 rounded-lg border shrink-0 ${app.colorClass}`}>
                    {app.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {app.name}
                      </h4>
                      {app.isActive ? (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                          Sedang Dibuka
                        </span>
                      ) : (
                        <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {app.subtitle}
                    </p>
                    <span className="inline-block text-[10px] text-slate-400 font-medium mt-1">
                      {app.category}
                    </span>
                  </div>
                </div>
              );

              return app.isExternal ? (
                <a
                  key={app.id}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block no-underline"
                >
                  {content}
                </a>
              ) : (
                <Link key={app.id} href={app.url} className="block no-underline">
                  {content}
                </Link>
              );
            })}
          </div>

          {/* Footer Portal Link */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100">
            <Link
              href="/portal"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                <span>Buka Launchpad Ops Terpusat</span>
              </div>
              <span className="text-[11px] font-bold">&rarr;</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
