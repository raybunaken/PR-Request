'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  RefreshCw, 
  Search, 
  FileSpreadsheet, 
  FileText, 
  Play, 
  Check, 
  X, 
  Building2, 
  User,
  CheckSquare,
  Square,
  ExternalLink,
  Cloud,
  CloudOff,
  Copy,
  Folder,
  FolderPlus,
  FolderCheck,
  FileCheck2,
  FolderOpen,
  Download,
  Mail,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface DealItem {
  row: number;
  dbRow: number;
  customerName: string;
  bank: string;
  percentage: string;
  commission: number;
  targetAmount: number;
  entity: 'NND' | 'WMI';
  company: string;
  agentName: string;
  payeeName: string;
  statusColK: string;
  syncStatus: 'SINKRON' | 'PERLU_TIMPA' | 'BELUM_ADA';
  isBtnCombined: boolean;
  partnerRow?: number | null;
  tanggalAkad?: string;
  plafond?: number;
  moCode?: string;
  typeKpr?: string;
  grouping?: string;
  leadsFolderUrl?: string;
  leadsFolderName?: string;
  hasLeadsFolder?: boolean;
  prFolderUrl?: string;
  prFileUrl?: string;
}

interface CompletedItem {
  name: string;
  prUrl?: string;
  folderUrl?: string;
  leadsFolderUrl?: string;
  driveSynced: boolean;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'PR_AGENT' | 'LEADS_FOLDER'>('PR_AGENT');
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'ALL' | 'PERLU_TIMPA' | 'SINKRON' | 'BELUM_ADA' | 'HAS_FOLDER' | 'NO_FOLDER' | 'DIRECT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Option checkbox: Sekaligus buat/sync Folder Leads saat Proses PR
  const [syncLeadsFolderWithPR, setSyncLeadsFolderWithPR] = useState<boolean>(true);

  // Tab Counts for badges
  const [tabCounts, setTabCounts] = useState<{ agent: number; all: number }>({ agent: 0, all: 0 });

  // Google Drive Status
  const [driveStatus, setDriveStatus] = useState<{
    checked: boolean;
    connected: boolean;
    serviceAccountEmail: string;
    folderId: string;
  }>({
    checked: false,
    connected: false,
    serviceAccountEmail: 'robot-kpr@kpr-automation.iam.gserviceaccount.com',
    folderId: '1hlmmnsWDEVocTbMi3rWYWSh6zhu99VsM'
  });
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Progress state for PR Batch
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    total: number;
    current: number;
    currentName: string;
    completed: CompletedItem[];
    failed: string[];
  }>({ total: 0, current: 0, currentName: '', completed: [], failed: [] });
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Progress state for Leads Folder Action
  const [isProcessingLeads, setIsProcessingLeads] = useState<boolean>(false);
  const [retryingCustomer, setRetryingCustomer] = useState<string | null>(null);
  const [expandedRetryItem, setExpandedRetryItem] = useState<string | null>(null);
  const [manualKeywords, setManualKeywords] = useState<Record<string, string>>({});
  const [leadsModalData, setLeadsModalData] = useState<{
    isOpen: boolean;
    title: string;
    items: Array<{
      customerName: string;
      moCode?: string;
      bankName?: string;
      row?: number;
      folderName: string;
      folderUrl: string;
      hasSpa: boolean;
      hasBankEmail: boolean;
      spaFile?: { id: string; name: string; url: string };
      bankEmailFile?: { id: string; name: string; url: string };
      isNew: boolean;
    }>;
  }>({
    isOpen: false,
    title: '',
    items: []
  });

  const fetchDeals = async (tabMode: 'PR_AGENT' | 'LEADS_FOLDER' = activeTab) => {
    setLoading(true);
    setError(null);
    try {
      const tabParam = tabMode === 'PR_AGENT' ? 'agent' : 'all';
      const res = await fetch(`/api/deals?tab=${tabParam}`);
      const data = await res.json();
      if (data.success) {
        setDeals(data.deals);
        if (tabMode === 'PR_AGENT') {
          setTabCounts(prev => ({ ...prev, agent: data.deals.length }));
        } else {
          setTabCounts(prev => ({ ...prev, all: data.deals.length }));
        }
      } else {
        setError(data.error || 'Gagal memuat data.');
      }
    } catch (err: any) {
      setError(err.message || 'Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriveStatus = async () => {
    try {
      const res = await fetch('/api/drive-status');
      const data = await res.json();
      if (data.success) {
        setDriveStatus({
          checked: true,
          connected: data.connected,
          serviceAccountEmail: data.serviceAccountEmail,
          folderId: data.folderId
        });
      }
    } catch {
      setDriveStatus(prev => ({ ...prev, checked: true, connected: false }));
    }
  };

  // Pre-fetch count for other tab once
  useEffect(() => {
    fetchDeals('PR_AGENT');
    fetchDriveStatus();

    // Fetch 'all' count in background
    fetch('/api/deals?tab=all')
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setTabCounts(prev => ({ ...prev, all: d.deals.length }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSwitchTab = (newTab: 'PR_AGENT' | 'LEADS_FOLDER') => {
    setActiveTab(newTab);
    setSelectedRows(new Set());
    setFilter('ALL');
    setSearchQuery('');
    fetchDeals(newTab);
  };

  // Summary counts for Tab 1 (PR Agent)
  const agentSummary = useMemo(() => {
    return {
      total: deals.length,
      outdated: deals.filter(d => d.syncStatus === 'PERLU_TIMPA').length,
      synced: deals.filter(d => d.syncStatus === 'SINKRON').length,
      missing: deals.filter(d => d.syncStatus === 'BELUM_ADA').length,
      withFolder: deals.filter(d => d.hasLeadsFolder).length,
    };
  }, [deals]);

  // Summary counts for Tab 2 (Leads Folder Finance)
  const leadsSummary = useMemo(() => {
    return {
      total: deals.length,
      withFolder: deals.filter(d => d.hasLeadsFolder).length,
      withoutFolder: deals.filter(d => !d.hasLeadsFolder).length,
      direct: deals.filter(d => d.grouping?.toLowerCase().includes('direct') || d.agentName === 'Direct Customer').length,
      agent: deals.filter(d => !d.grouping?.toLowerCase().includes('direct') && d.agentName !== 'Direct Customer').length,
    };
  }, [deals]);

  // Filtered deals
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      let statusMatch = true;
      if (activeTab === 'PR_AGENT') {
        statusMatch = (filter === 'ALL' || d.syncStatus === filter);
      } else {
        if (filter === 'HAS_FOLDER') statusMatch = !!d.hasLeadsFolder;
        else if (filter === 'NO_FOLDER') statusMatch = !d.hasLeadsFolder;
        else if (filter === 'DIRECT') statusMatch = d.grouping?.toLowerCase().includes('direct') || d.agentName === 'Direct Customer';
      }

      const query = searchQuery.trim().toLowerCase();
      const searchMatch = !query || 
        d.customerName.toLowerCase().includes(query) ||
        d.bank.toLowerCase().includes(query) ||
        d.agentName.toLowerCase().includes(query) ||
        (d.moCode && d.moCode.toLowerCase().includes(query));
      return statusMatch && searchMatch;
    });
  }, [deals, filter, searchQuery, activeTab]);

  // Selection handlers
  const handleToggleRow = (row: number) => {
    const next = new Set(selectedRows);
    if (next.has(row)) {
      next.delete(row);
    } else {
      next.add(row);
    }
    setSelectedRows(next);
  };

  const handleSelectAllVisible = () => {
    const next = new Set(selectedRows);
    filteredDeals.forEach(d => next.add(d.row));
    setSelectedRows(next);
  };

  const handleDeselectAll = () => {
    setSelectedRows(new Set());
  };

  const handleSelectOnlyOutdated = () => {
    const next = new Set<number>();
    deals.filter(d => d.syncStatus === 'PERLU_TIMPA').forEach(d => next.add(d.row));
    setSelectedRows(next);
  };

  const handleSelectOnlyNoFolder = () => {
    const next = new Set<number>();
    deals.filter(d => !d.hasLeadsFolder).forEach(d => next.add(d.row));
    setSelectedRows(next);
  };

  // PR Batch process
  const handleStartBatchPR = async () => {
    const toProcess = deals.filter(d => selectedRows.has(d.row));
    if (toProcess.length === 0) return;

    setIsProcessing(true);
    setIsModalOpen(true);
    setProgress({
      total: toProcess.length,
      current: 0,
      currentName: toProcess[0].customerName,
      completed: [],
      failed: []
    });

    const completed: CompletedItem[] = [];
    const failed: string[] = [];

    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      setProgress(prev => ({
        ...prev,
        current: i + 1,
        currentName: item.customerName
      }));

      try {
        const res = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            deals: [item],
            syncLeadsFolder: syncLeadsFolderWithPR 
          })
        });
        const data = await res.json();
        if (data.success && data.successCount > 0) {
          const resObj = data.results?.[0];
          completed.push({
            name: item.customerName,
            prUrl: resObj?.prUrl,
            folderUrl: resObj?.folderUrl,
            leadsFolderUrl: resObj?.leadsFolderUrl,
            driveSynced: !!resObj?.driveSynced
          });
        } else {
          failed.push(item.customerName);
        }
      } catch {
        failed.push(item.customerName);
      }

      setProgress(prev => ({
        ...prev,
        completed: [...completed],
        failed: [...failed]
      }));
    }

    setIsProcessing(false);
    fetchDeals(activeTab);
    fetchDriveStatus();
  };

  // Single deal PR process
  const handleProcessSinglePR = async (deal: DealItem) => {
    setIsProcessing(true);
    setIsModalOpen(true);
    setProgress({
      total: 1,
      current: 1,
      currentName: deal.customerName,
      completed: [],
      failed: []
    });

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deals: [deal],
          syncLeadsFolder: syncLeadsFolderWithPR 
        })
      });
      const data = await res.json();
      if (data.success && data.successCount > 0) {
        const resObj = data.results?.[0];
        setProgress(prev => ({
          ...prev,
          completed: [{
            name: deal.customerName,
            prUrl: resObj?.prUrl,
            folderUrl: resObj?.folderUrl,
            leadsFolderUrl: resObj?.leadsFolderUrl,
            driveSynced: !!resObj?.driveSynced
          }]
        }));
      } else {
        setProgress(prev => ({
          ...prev,
          failed: [deal.customerName]
        }));
      }
    } catch {
      setProgress(prev => ({
        ...prev,
        failed: [deal.customerName]
      }));
    } finally {
      setIsProcessing(false);
      fetchDeals(activeTab);
      fetchDriveStatus();
    }
  };

  // Single Leads Folder Create / Fetch Gmail
  const handleCreateLeadsFolderSingle = async (deal: DealItem, fetchGmail: boolean = true) => {
    setIsProcessingLeads(true);
    try {
      const res = await fetch('/api/leads-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row: deal.row,
          dbRow: deal.dbRow,
          customerName: deal.customerName,
          moCode: deal.moCode,
          bankName: deal.bank,
          fetchFromGmail: fetchGmail
        })
      });
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        const itemRes = data.results[0];
        setLeadsModalData({
          isOpen: true,
          title: fetchGmail ? 'Tarik SPA & Email Bank Selesai' : 'Folder Leads Finance Berhasil Dibuat',
          items: [{
            customerName: deal.customerName,
            moCode: deal.moCode,
            bankName: deal.bank,
            row: deal.row,
            folderName: itemRes.folder?.name || deal.customerName,
            folderUrl: itemRes.folder?.url || '',
            hasSpa: !!itemRes.fileCheck?.hasSpa,
            hasBankEmail: !!itemRes.fileCheck?.hasBankEmail,
            spaFile: itemRes.fileCheck?.spaFile,
            bankEmailFile: itemRes.fileCheck?.bankEmailFile,
            isNew: !!itemRes.folder?.isNew
          }]
        });
        fetchDeals(activeTab);
      } else {
        alert(data.error || 'Gagal memproses berkas leads.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan koneksi.');
    } finally {
      setIsProcessingLeads(false);
    }
  };

  // Batch Leads Folder Create / Fetch Gmail
  const handleCreateLeadsFolderBatch = async (fetchGmail: boolean = true) => {
    const toProcess = deals.filter(d => selectedRows.has(d.row));
    if (toProcess.length === 0) return;

    setIsProcessingLeads(true);
    try {
      const items = toProcess.map(d => ({
        row: d.row,
        dbRow: d.dbRow,
        customerName: d.customerName,
        moCode: d.moCode,
        bankName: d.bank,
        fetchFromGmail: fetchGmail
      }));

      const res = await fetch('/api/leads-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, fetchFromGmail: fetchGmail })
      });
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        setLeadsModalData({
          isOpen: true,
          title: fetchGmail 
            ? `Tarik Berkas Selesai (${data.results.length} Nasabah)`
            : `Batch Folder Leads Selesai (${data.results.length} Folder)`,
          items: data.results.map((r: any) => {
            const matchedDeal = toProcess.find(d => d.customerName === r.customerName);
            return {
              customerName: r.customerName,
              moCode: matchedDeal?.moCode || '',
              bankName: matchedDeal?.bank || '',
              row: r.row,
              folderName: r.folder?.name || r.customerName,
              folderUrl: r.folder?.url || '',
              hasSpa: !!r.fileCheck?.hasSpa,
              hasBankEmail: !!r.fileCheck?.hasBankEmail,
              spaFile: r.fileCheck?.spaFile,
              bankEmailFile: r.fileCheck?.bankEmailFile,
              isNew: !!r.folder?.isNew
            };
          })
        });
        fetchDeals(activeTab);
      } else {
        alert(data.error || 'Gagal memproses batch Folder Leads.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan koneksi.');
    } finally {
      setIsProcessingLeads(false);
    }
  };

  // Retry search dengan custom keyword jika ada perbedaan nama nasabah di email
  const handleRetrySearchForCustomer = async (item: any) => {
    const customKeyword = (manualKeywords[item.customerName] || '').trim();
    setRetryingCustomer(item.customerName);
    try {
      const res = await fetch('/api/leads-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row: item.row,
          customerName: item.customerName,
          moCode: item.moCode,
          bankName: item.bankName,
          fetchFromGmail: true,
          customSpaQuery: customKeyword ? `"SPA" "${customKeyword}" has:attachment` : '',
          customBankQuery: customKeyword ? `"Konfirmasi" "${customKeyword}"` : ''
        })
      });
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        const updated = data.results[0];
        setLeadsModalData(prev => ({
          ...prev,
          items: prev.items.map(it => it.customerName === item.customerName ? {
            ...it,
            folderName: updated.folder?.name || it.folderName,
            folderUrl: updated.folder?.url || it.folderUrl,
            hasSpa: !!updated.fileCheck?.hasSpa,
            hasBankEmail: !!updated.fileCheck?.hasBankEmail,
            spaFile: updated.fileCheck?.spaFile,
            bankEmailFile: updated.fileCheck?.bankEmailFile,
          } : it)
        }));
      } else {
        alert(data.error || 'Pencarian ulang tidak menghasilkan dokumen.');
      }
    } catch (err: any) {
      alert('Gagal mencari ulang: ' + (err.message || 'Koneksi error'));
    } finally {
      setRetryingCustomer(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
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
                  99 Group &bull; KPR Mortgage Operations Hub
                </h1>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Automation
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Otomasi Pembayaran Komisi Agent, Agreement, dan Folder Bukti Finance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Drive Connection Status Pill */}
            {driveStatus.checked && (
              driveStatus.connected ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Google Drive Terhubung</span>
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Drive Perlu Izin Share</span>
                </span>
              )
            )}

            <a
              href="https://docs.google.com/spreadsheets/d/1lElsVhaOSTrg7-dGpqdnaPt17VCdykOnuGw78RW96ag"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <span>Buka Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
            <button
              onClick={() => { fetchDeals(activeTab); fetchDriveStatus(); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Drive Access Notice Banner */}
        {driveStatus.checked && !driveStatus.connected && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                  <CloudOff className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">
                    Izin Folder Google Drive Diperlukan untuk Penimpaan Berkas Otomatis
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Bagikan (Share) folder root <b>Referral Fee Agent</b> dan folder <b>Leads Akad Automation</b> di Google Drive Anda ke email service account berikut sebagai <b>Editor</b>:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <code className="text-xs bg-white px-2.5 py-1 rounded-md border border-amber-300 font-mono text-slate-900 font-semibold select-all">
                      {driveStatus.serviceAccountEmail}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(driveStatus.serviceAccountEmail);
                        setCopiedEmail(true);
                        setTimeout(() => setCopiedEmail(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-2.5 py-1 rounded-md transition-colors"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEmail ? 'Email Tersalin' : 'Salin Email'}</span>
                    </button>
                    <button
                      onClick={fetchDriveStatus}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Cek Ulang Izin</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB SWITCHER */}
        <div className="flex border-b border-slate-200 mb-6 gap-2 sm:gap-6 bg-white px-4 pt-3 rounded-t-xl border-t border-x">
          <button
            onClick={() => handleSwitchTab('PR_AGENT')}
            className={`pb-3.5 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'PR_AGENT'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>PR Request &amp; Agreement (Agent)</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              activeTab === 'PR_AGENT' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {tabCounts.agent || agentSummary.total}
            </span>
          </button>

          <button
            onClick={() => handleSwitchTab('LEADS_FOLDER')}
            className={`pb-3.5 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'LEADS_FOLDER'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Folder Leads Finance (Semua Akad)</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              activeTab === 'LEADS_FOLDER' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {tabCounts.all || leadsSummary.total}
            </span>
          </button>
        </div>

        {/* TAB 1: PR REQUEST & AGREEMENT (AGENT) */}
        {activeTab === 'PR_AGENT' && (
          <>
            {/* Metric Cards for Agent Tab */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Transaksi Agent</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{agentSummary.total}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-rose-600">Perlu Ditimpa / Outdated</p>
                  <p className="text-2xl font-bold text-rose-700 mt-1">{agentSummary.outdated}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-600">Sudah Sinkron</p>
                  <p className="text-2xl font-bold text-emerald-700 mt-1">{agentSummary.synced}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600">Belum Ada PR</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{agentSummary.missing}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Toolbar & Filter Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
                  <button
                    onClick={() => setFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      filter === 'ALL'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({agentSummary.total})
                  </button>
                  <button
                    onClick={() => setFilter('PERLU_TIMPA')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      filter === 'PERLU_TIMPA'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Perlu Ditimpa ({agentSummary.outdated})</span>
                  </button>
                  <button
                    onClick={() => setFilter('SINKRON')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      filter === 'SINKRON'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sudah Sinkron ({agentSummary.synced})</span>
                  </button>
                  <button
                    onClick={() => setFilter('BELUM_ADA')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      filter === 'BELUM_ADA'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Belum Ada PR ({agentSummary.missing})</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[260px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nasabah, bank, atau agen..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action and Batch Selection Bar */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSelectAllVisible}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pilih Semua Tampil ({filteredDeals.length})</span>
                  </button>
                  {agentSummary.outdated > 0 && (
                    <button
                      onClick={handleSelectOnlyOutdated}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Pilih yang Perlu Ditimpa ({agentSummary.outdated})</span>
                    </button>
                  )}
                  {selectedRows.size > 0 && (
                    <button
                      onClick={handleDeselectAll}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      <span>Batal Pilih ({selectedRows.size})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Option: Sekaligus buat Folder Leads */}
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={syncLeadsFolderWithPR}
                      onChange={e => setSyncLeadsFolderWithPR(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Sekaligus Hubungkan Folder Leads Finance (SPA + Email)</span>
                  </label>

                  <button
                    onClick={handleStartBatchPR}
                    disabled={selectedRows.size === 0 || isProcessing}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Proses PR &amp; Timpa Terpilih ({selectedRows.size})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Table for Tab 1 (PR Agent) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredDeals.length > 0 && filteredDeals.every(d => selectedRows.has(d.row))}
                          onChange={e => {
                            if (e.target.checked) handleSelectAllVisible();
                            else handleDeselectAll();
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                      </th>
                      <th className="py-3 px-4">Nasabah &amp; Tanggal</th>
                      <th className="py-3 px-4">Bank &amp; Plafond</th>
                      <th className="py-3 px-4">Agent Referee</th>
                      <th className="py-3 px-4 text-right">Nominal PR (Final)</th>
                      <th className="py-3 px-4">Entitas PT</th>
                      <th className="py-3 px-4 text-center">Status PR</th>
                      <th className="py-3 px-4 text-center">Folder Leads</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                          <span>Memuat data transaksi dari Google Sheets...</span>
                        </td>
                      </tr>
                    ) : filteredDeals.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          Tidak ada transaksi yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredDeals.map(deal => {
                        const isSelected = selectedRows.has(deal.row);
                        const isPartner = deal.isBtnCombined;

                        return (
                          <tr
                            key={deal.row}
                            className={`transition-colors hover:bg-slate-50/80 ${
                              isSelected ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRow(deal.row)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{deal.customerName}</span>
                                {isPartner && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    2 Baris BTN
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {deal.tanggalAkad || 'Tanggal Akad -'}
                                {deal.moCode && (
                                  <span className="ml-2 font-mono font-medium text-slate-600 bg-slate-100 px-1 py-0.5 rounded">
                                    {deal.moCode}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-800">{deal.bank}</div>
                              <div className="text-[11px] text-slate-500">
                                {deal.plafond ? `Rp ${deal.plafond.toLocaleString('id-ID')}` : '-'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px] border border-blue-100">
                                  {deal.percentage}
                                </span>
                                <span className="font-medium text-slate-800">{deal.agentName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="font-bold text-slate-900">
                                Rp {deal.targetAmount.toLocaleString('id-ID')}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Bersih Finance
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  deal.entity === 'WMI'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                <Building2 className="w-3 h-3" />
                                {deal.entity}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {deal.syncStatus === 'SINKRON' ? (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  {deal.prFolderUrl || deal.prFileUrl ? (
                                    <a
                                      href={deal.prFolderUrl || deal.prFileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={deal.prFolderUrl ? "Buka Folder PR & Attachment di Google Drive" : "Buka Berkas PR di Drive"}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Sinkron</span>
                                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 ml-0.5" />
                                    </a>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Sinkron</span>
                                    </span>
                                  )}
                                  {deal.prFolderUrl && (
                                    <a
                                      href={deal.prFolderUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      <FolderOpen className="w-2.5 h-2.5" />
                                      <span>Buka Folder PR</span>
                                    </a>
                                  )}
                                </div>
                              ) : deal.syncStatus === 'PERLU_TIMPA' ? (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  {deal.prFolderUrl || deal.prFileUrl ? (
                                    <a
                                      href={deal.prFolderUrl || deal.prFileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Buka Berkas PR Sebelumnya di Drive"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer animate-pulse"
                                    >
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      <span>Perlu Timpa</span>
                                      <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                                    </a>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      <span>Perlu Timpa</span>
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Belum Ada</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {deal.leadsFolderUrl ? (
                                <a
                                  href={deal.leadsFolderUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
                                  title={deal.leadsFolderName}
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  <span>Buka Folder</span>
                                </a>
                              ) : (
                                <button
                                  onClick={() => handleCreateLeadsFolderSingle(deal)}
                                  disabled={isProcessingLeads}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
                                >
                                  <FolderPlus className="w-3 h-3" />
                                  <span>+ Hubungkan</span>
                                </button>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleProcessSinglePR(deal)}
                                  disabled={isProcessing}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition-colors cursor-pointer"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Proses</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: FOLDER LEADS FINANCE (SEMUA AKAD) */}
        {activeTab === 'LEADS_FOLDER' && (
          <>
            {/* Metric Cards for Leads Folder Tab */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Seluruh Akad KPR</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{leadsSummary.total}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-indigo-600">Folder Leads Terhubung</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">{leadsSummary.withFolder}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FolderCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600">Belum Ada Folder</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{leadsSummary.withoutFolder}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Nasabah Direct / Non-Agent</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{leadsSummary.direct}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <User className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Leads Folder Toolbar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
                  <button
                    onClick={() => setFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      filter === 'ALL'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua Akad ({leadsSummary.total})
                  </button>
                  <button
                    onClick={() => setFilter('NO_FOLDER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      filter === 'NO_FOLDER'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Belum Ada Folder ({leadsSummary.withoutFolder})</span>
                  </button>
                  <button
                    onClick={() => setFilter('HAS_FOLDER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      filter === 'HAS_FOLDER'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <FolderCheck className="w-3.5 h-3.5" />
                    <span>Sudah Ada Folder ({leadsSummary.withFolder})</span>
                  </button>
                  <button
                    onClick={() => setFilter('DIRECT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                      filter === 'DIRECT'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Direct Customer ({leadsSummary.direct})</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[260px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama, #MO, atau bank..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action and Batch Selection Bar for Leads Folder */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSelectAllVisible}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pilih Semua Tampil ({filteredDeals.length})</span>
                  </button>
                  {leadsSummary.withoutFolder > 0 && (
                    <button
                      onClick={handleSelectOnlyNoFolder}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                      <span>Pilih yang Belum Ada Folder ({leadsSummary.withoutFolder})</span>
                    </button>
                  )}
                  {selectedRows.size > 0 && (
                    <button
                      onClick={handleDeselectAll}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      <span>Batal Pilih ({selectedRows.size})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    Folder Induk: <b>Leads Akad Automation</b> di Drive
                  </span>
                  <button
                    onClick={() => handleCreateLeadsFolderBatch(true)}
                    disabled={selectedRows.size === 0 || isProcessingLeads}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    {isProcessingLeads ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    <span>Tarik SPA &amp; Email Bank ({selectedRows.size})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Table for Tab 2 (Leads Folder Finance) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredDeals.length > 0 && filteredDeals.every(d => selectedRows.has(d.row))}
                          onChange={e => {
                            if (e.target.checked) handleSelectAllVisible();
                            else handleDeselectAll();
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                      </th>
                      <th className="py-3 px-4">Kode #MO &amp; Baris DB</th>
                      <th className="py-3 px-4">Nama Nasabah &amp; Tanggal</th>
                      <th className="py-3 px-4">Bank &amp; Plafond</th>
                      <th className="py-3 px-4">Tipe KPR</th>
                      <th className="py-3 px-4">Jalur Transaksi</th>
                      <th className="py-3 px-4 text-center">Status Folder Drive</th>
                      <th className="py-3 px-4 text-center">Aksi Folder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                          <span>Memuat seluruh data akad KPR...</span>
                        </td>
                      </tr>
                    ) : filteredDeals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Tidak ada transaksi yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredDeals.map(deal => {
                        const isSelected = selectedRows.has(deal.row);
                        const isDirect = deal.grouping?.toLowerCase().includes('direct') || deal.agentName === 'Direct Customer';

                        return (
                          <tr
                            key={deal.row}
                            className={`transition-colors hover:bg-slate-50/80 ${
                              isSelected ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRow(deal.row)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-slate-800">
                                {deal.moCode || `Row #${deal.dbRow}`}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                DB Row {deal.dbRow}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{deal.customerName}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {deal.tanggalAkad || 'Tanggal Akad -'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-800">{deal.bank}</div>
                              <div className="text-[11px] text-slate-500">
                                {deal.plafond ? `Rp ${deal.plafond.toLocaleString('id-ID')}` : '-'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                {deal.typeKpr || 'KPR'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isDirect ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                  <User className="w-3 h-3" />
                                  Direct Customer
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                  <span>Via {deal.agentName} ({deal.percentage})</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {deal.leadsFolderUrl ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <FolderCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Folder Ada</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Belum Dibuat</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {deal.leadsFolderUrl ? (
                                  <>
                                    <a
                                      href={deal.leadsFolderUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                      title="Buka Folder di Drive"
                                    >
                                      <FolderOpen className="w-3 h-3 text-slate-500" />
                                      <span>Buka</span>
                                    </a>
                                    <button
                                      onClick={() => handleCreateLeadsFolderSingle(deal, true)}
                                      disabled={isProcessingLeads}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                      title="Tarik SPA & Email Bank dari Gmail Dzaky"
                                    >
                                      <Mail className="w-3 h-3" />
                                      <span>Tarik Berkas</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleCreateLeadsFolderSingle(deal, true)}
                                    disabled={isProcessingLeads}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
                                    title="Buat folder di Drive dan tarik berkas dari Gmail"
                                  >
                                    <FolderPlus className="w-3 h-3" />
                                    <span>Buat &amp; Tarik Berkas</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Progress / Completion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                    <span>Sedang Memproses Berkas...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Proses Selesai</span>
                  </>
                )}
              </h3>
              {!isProcessing && (
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="py-6">
              {isProcessing ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Memproses {progress.current} dari {progress.total}</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 truncate text-center">
                    Sedang memproses: <b className="text-slate-800">{progress.currentName}</b>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-emerald-900">
                        {progress.completed.length} Berkas Berhasil Diproses &amp; Ditimpa
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Dokumen PR di Drive, Agreement PDF, dan Spreadsheet Controller telah diperbarui.
                      </p>
                    </div>
                  </div>

                  {progress.completed.length > 0 && (
                    <div className="max-h-64 overflow-y-auto space-y-2.5 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                      {progress.completed.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs gap-2"
                        >
                          <span className="font-semibold text-slate-800 truncate mr-2">
                            {item.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {item.folderUrl ? (
                              <a
                                href={item.folderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                                title="Buka Folder Drive Nasabah tempat PR, Agreement PDF, PKS, & No Rekening tersimpan"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>Buka Folder PR (Attachment)</span>
                                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                              </a>
                            ) : null}
                            {item.prUrl && (
                              <a
                                href={item.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
                                title="Buka Spreadsheet PR Langsung"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                                <span>File PR</span>
                              </a>
                            )}
                            {item.leadsFolderUrl && (
                              <a
                                href={item.leadsFolderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                                title="Buka Folder Bukti Finance (SPA & Email Bank)"
                              >
                                <FolderCheck className="w-3 h-3" />
                                <span>Folder Leads (Finance)</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {progress.failed.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-xs font-semibold text-rose-800">
                        Gagal memproses {progress.failed.length} nasabah:
                      </p>
                      <p className="text-xs text-rose-700 mt-1">
                        {progress.failed.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isProcessing && (
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leads Folder Result Modal */}
      {leadsModalData.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{leadsModalData.title}</span>
              </h3>
              <button
                onClick={() => setLeadsModalData(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                <p className="font-semibold">
                  Folder Google Drive (Leads Akad Automation) telah disinkronkan.
                </p>
                <p className="text-emerald-700 mt-1">
                  Berkas SPA Signed dari Dropbox Sign dan PDF Arsip Konfirmasi Plafond Bank ditarik langsung dari kotak masuk Gmail (dzaky.rayssa@99.co).
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-3 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                {leadsModalData.items.map((item, idx) => {
                  const isRetrying = retryingCustomer === item.customerName;
                  const isExpanded = expandedRetryItem === item.customerName;
                  const hasMissingDoc = !item.hasSpa || !item.hasBankEmail;

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">
                              {item.customerName}
                            </span>
                            {item.moCode && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                {item.moCode}
                              </span>
                            )}
                            {item.bankName && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                {item.bankName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">
                            Folder: {item.folderName}
                          </div>
                        </div>

                        {item.folderUrl && (
                          <a
                            href={item.folderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors shrink-0"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Buka Folder</span>
                            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                          </a>
                        )}
                      </div>

                      {/* Document Status Rows */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                        {/* SPA Document */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {item.hasSpa ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>SPA Signed Tersimpan</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>SPA Belum Ditemukan di Gmail</span>
                              </span>
                            )}
                          </div>

                          {item.spaFile?.url && (
                            <a
                              href={item.spaFile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Lihat SPA PDF</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </a>
                          )}
                        </div>

                        {/* Bank Confirmation Email Document */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {item.hasBankEmail ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>PDF Email Konfirmasi Bank Tersimpan</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Email Bank Belum Ditemukan di Gmail</span>
                              </span>
                            )}
                          </div>

                          {item.bankEmailFile?.url && (
                            <a
                              href={item.bankEmailFile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Lihat Email PDF</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Manual Search Accordion for Case 1 / Typos */}
                      {hasMissingDoc && (
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            onClick={() => setExpandedRetryItem(isExpanded ? null : item.customerName)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            <span>Coba Cari Ulang dengan Kata Kunci Khusus / Nama Lain</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                              <p className="text-[11px] text-slate-600">
                                Jika nama nasabah di email sedikit berbeda atau disingkat:
                              </p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Contoh: nama nasabah tanpa PT, nama PIC, dll"
                                  value={manualKeywords[item.customerName] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setManualKeywords(prev => ({ ...prev, [item.customerName]: val }));
                                  }}
                                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden focus:border-indigo-500"
                                />
                                <button
                                  onClick={() => handleRetrySearchForCustomer(item)}
                                  disabled={isRetrying}
                                  className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                                >
                                  {isRetrying ? 'Mencari...' : 'Cari Ulang'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setLeadsModalData(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
