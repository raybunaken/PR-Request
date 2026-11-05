'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gift, 
  Search, 
  Folder, 
  FileSpreadsheet, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  FileText, 
  Sparkles,
  Layers,
  Building2,
  DollarSign
} from 'lucide-react';
import { CashbackDealItem } from '@/lib/cashback-client';

interface CashbackTabProps {
  onCountUpdate?: (count: number) => void;
}

export default function CashbackTab({ onCountUpdate }: CashbackTabProps) {
  const [deals, setDeals] = useState<CashbackDealItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'ALL' | 'BELUM_ADA' | 'SINKRON'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    total: number;
    current: number;
    currentName: string;
    completed: any[];
    failed: string[];
  }>({ total: 0, current: 0, currentName: '', completed: [], failed: [] });
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Fetch cashback deals
  const fetchDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/cashback');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memuat data transaksi Cashback KPR');
      }
      setDeals(data.deals || []);
      if (onCountUpdate) {
        onCountUpdate(data.deals?.length || 0);
      }
    } catch (err: any) {
      console.error('Error fetching cashback deals:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat data cashback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = deals.length;
    const synced = deals.filter(d => d.syncStatus === 'SINKRON').length;
    const missing = deals.filter(d => d.syncStatus === 'BELUM_ADA').length;
    const totalAmount = deals.reduce((acc, curr) => acc + (curr.cashbackAmount || 0), 0);
    return { total, synced, missing, totalAmount };
  }, [deals]);

  // Filtered deals
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      let statusMatch = true;
      if (filter === 'BELUM_ADA') statusMatch = d.syncStatus === 'BELUM_ADA';
      else if (filter === 'SINKRON') statusMatch = d.syncStatus === 'SINKRON';

      const query = searchQuery.trim().toLowerCase();
      const searchMatch = !query ||
        d.customerName.toLowerCase().includes(query) ||
        d.bank.toLowerCase().includes(query) ||
        (d.moCode && d.moCode.toLowerCase().includes(query));

      return statusMatch && searchMatch;
    });
  }, [deals, filter, searchQuery]);

  // Selection handlers
  const handleToggleRow = (row: number) => {
    const next = new Set(selectedRows);
    if (next.has(row)) next.delete(row);
    else next.add(row);
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

  const handleSelectOnlyMissing = () => {
    const next = new Set<number>();
    deals.filter(d => d.syncStatus === 'BELUM_ADA').forEach(d => next.add(d.row));
    setSelectedRows(next);
  };

  // Process selected deals
  const handleProcessSelected = async () => {
    const selectedDeals = deals.filter(d => selectedRows.has(d.row));
    if (selectedDeals.length === 0) return;

    setIsProcessing(true);
    setIsModalOpen(true);
    setProgress({
      total: selectedDeals.length,
      current: 0,
      currentName: selectedDeals[0]?.customerName || '',
      completed: [],
      failed: []
    });

    try {
      const res = await fetch('/api/cashback/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deals: selectedDeals })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses batch cashback');
      }

      const results = data.results || [];
      const successful = results.filter((r: any) => r.success);
      const failed = results.filter((r: any) => !r.success).map((r: any) => `${r.customerName}: ${r.error || 'Gagal'}`);

      setProgress({
        total: selectedDeals.length,
        current: selectedDeals.length,
        currentName: 'Selesai',
        completed: successful,
        failed
      });

      // Refresh list
      fetchDeals();
      setSelectedRows(new Set());
    } catch (err: any) {
      console.error('Batch process error:', err);
      setProgress(prev => ({
        ...prev,
        failed: [...prev.failed, err.message || 'Terjadi kesalahan sistem']
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Process single deal
  const handleProcessSingle = async (deal: CashbackDealItem) => {
    setIsProcessing(true);
    setIsModalOpen(true);
    setProgress({
      total: 1,
      current: 0,
      currentName: deal.customerName,
      completed: [],
      failed: []
    });

    try {
      const res = await fetch('/api/cashback/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deals: [deal] })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Gagal memproses cashback untuk ${deal.customerName}`);
      }

      const result = data.results?.[0];
      if (result && result.success) {
        setProgress({
          total: 1,
          current: 1,
          currentName: 'Selesai',
          completed: [result],
          failed: []
        });
      } else {
        throw new Error(result?.error || 'Gagal generate cashback');
      }

      fetchDeals();
    } catch (err: any) {
      setProgress(prev => ({
        ...prev,
        failed: [err.message || 'Gagal memproses cashback']
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Nasabah Cashback</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Gift className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-600">Folder &amp; PR Lengkap</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.synced}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-600">Belum Dibuat</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{summary.missing}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Nominal Cashback</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              Rp {summary.totalAmount.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({summary.total})
            </button>
            <button
              onClick={() => setFilter('BELUM_ADA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filter === 'BELUM_ADA'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Belum Dibuat ({summary.missing})</span>
            </button>
            <button
              onClick={() => setFilter('SINKRON')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filter === 'SINKRON'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Lengkap ({summary.synced})</span>
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nasabah, bank, #MO..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <button
              onClick={handleProcessSelected}
              disabled={selectedRows.size === 0 || isProcessing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Folder &amp; PR ({selectedRows.size})</span>
            </button>
          </div>
        </div>

        {/* Quick select helpers */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>Pilih cepat:</span>
            <button
              onClick={handleSelectAllVisible}
              className="text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
            >
              Semua Ditampilkan ({filteredDeals.length})
            </button>
            <span>&bull;</span>
            <button
              onClick={handleSelectOnlyMissing}
              className="text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
            >
              Hanya Belum Dibuat ({summary.missing})
            </button>
            {selectedRows.size > 0 && (
              <>
                <span>&bull;</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Batal Pilih ({selectedRows.size})
                </button>
              </>
            )}
          </div>
          <span className="text-slate-400">
            Format: Folder Nasabah + Shortcut Memo NND/WMI + PR Spreadsheet
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredDeals.length > 0 && filteredDeals.every(d => selectedRows.has(d.row))}
                    onChange={e => {
                      if (e.target.checked) handleSelectAllVisible();
                      else handleDeselectAll();
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">No</th>
                <th className="py-3 px-4">Nama Nasabah &amp; Tanggal</th>
                <th className="py-3 px-4">Bank &amp; Entitas</th>
                <th className="py-3 px-4">Plafond GMV</th>
                <th className="py-3 px-4">Nominal Cashback</th>
                <th className="py-3 px-4">Memo Program</th>
                <th className="py-3 px-4">Folder Cashback</th>
                <th className="py-3 px-4">Berkas PR Request</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Memuat data transaksi Cashback KPR...</span>
                  </td>
                </tr>
              ) : filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Gift className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span>Tidak ada transaksi cashback yang cocok dengan pencarian / filter.</span>
                  </td>
                </tr>
              ) : (
                filteredDeals.map(deal => {
                  const isSelected = selectedRows.has(deal.row);
                  return (
                    <tr
                      key={deal.row}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(deal.row)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-500">
                        {deal.row}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{deal.customerName}</span>
                          {deal.moCode && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded font-mono">
                              {deal.moCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Akad: {deal.tglAkad || '-'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{deal.bank}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{deal.entity} ({deal.company})</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        Rp {deal.plafond.toLocaleString('id-ID')}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-emerald-700 font-mono text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Rp {deal.cashbackAmount.toLocaleString('id-ID')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {deal.hasMemo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <FileText className="w-3 h-3" />
                            <span>Memo {deal.entity}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Akan dipasang
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {deal.folderUrl ? (
                          <a
                            href={deal.folderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-medium hover:underline"
                          >
                            <Folder className="w-3.5 h-3.5" />
                            <span>Buka Folder</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ) : (
                          <span className="text-amber-600 text-[11px] font-medium">
                            Belum Ada
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {deal.prUrl ? (
                          <a
                            href={deal.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>PR Request</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ) : (
                          <span className="text-amber-600 text-[11px] font-medium">
                            Belum Dibuat
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleProcessSingle(deal)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {deal.syncStatus === 'SINKRON' ? 'Update PR' : 'Generate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Progress & Results */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isProcessing ? 'Memproses Cashback KPR...' : 'Proses Cashback Selesai'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Folder Drive &bull; Shortcut Memo &bull; PR Spreadsheet
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="py-6">
              {isProcessing ? (
                <div className="text-center py-4">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-800">
                    Memproses: {progress.currentName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Sedang membuat folder nasabah, menempelkan shortcut Memo, dan mengisi PR Spreadsheet...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800">
                    <p className="font-semibold text-emerald-900 flex items-center gap-1.5 mb-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>{progress.completed.length} nasabah berhasil diproses</span>
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Folder nasabah telah dibuat, Memo program telah dipasang, dan PR Request Spreadsheet telah digenerate siap diisi upload dokumen manual.
                    </p>
                  </div>

                  {progress.completed.length > 0 && (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {progress.completed.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{item.customerName}</span>
                          <div className="flex items-center gap-2">
                            {item.folderUrl && (
                              <a
                                href={item.folderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>Folder</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {item.prUrl && (
                              <a
                                href={item.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>PR File</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {progress.failed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                      <p className="font-semibold mb-1">Peringatan:</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {progress.failed.map((msg, i) => (
                          <li key={i}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
