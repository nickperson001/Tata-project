import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton, TableSkeleton } from '../../components/LoadingSkeleton';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { RupiahInput } from '../../components/RupiahInput';
import { FilterBar } from '../../components/FilterBar';
import type { DateRange } from '../../components/DateRangeFilter';

import { Badge } from '../../components/Badge';
import { toast } from '../../components/Toast';
import { fmtRp, fmtQty, fmtDateTime } from '../../lib/utils';
import type { PaginationMeta } from '../../types';
import type { TransItem, PembukuanData } from '../../types';
import type { LabaRugiData, TrialBalanceData, StockSummaryData } from '../../types';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Download, Package, AlertTriangle, Info, DollarSign, CreditCard } from 'lucide-react';
import { DownloadButton } from '../../components/DownloadButton';
import { StockHutang } from './StockHutang';
import { StockPiutang } from './StockPiutang';

const CATEGORY_OPTIONS: { value: string; label: string; group: string }[] = [
  { value: 'beban_gaji',        label: 'Gaji',      group: 'expense' },
  { value: 'beban_sewa',        label: 'Sewa',      group: 'expense' },
  { value: 'beban_listrik_air', label: 'Listrik',   group: 'expense' },
  { value: 'beban_transport',   label: 'Transport', group: 'expense' },
  { value: 'beban_operasional', label: 'Operasional',group: 'expense' },
  { value: 'prive',             label: 'Prive',     group: 'expense' },
  { value: 'hutang_dagang',     label: 'Hutang',    group: 'expense' },
  { value: 'modal',             label: 'Modal',     group: 'income'  },
  { value: 'piutang',           label: 'Piutang',   group: 'income'  },
];

const CHANNEL_TEMPLATES: Record<string, { label: string; color: string }> = {
  offline:  { label: 'Toko Offline', color: '#10b981' },
  whatsapp: { label: 'WhatsApp', color: '#25d366' },
  shopee:   { label: 'Shopee', color: '#ee4d2d' },
  tokopedia:{ label: 'Tokopedia', color: '#42b549' },
  lazada:   { label: 'Lazada', color: '#0f146d' },
  tiktok:   { label: 'TikTok Shop', color: '#010101' },
};

const periods = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
  { label: '1 Tahun', days: 365 },
];

type Tab = 'transactions' | 'summary' | 'hutang' | 'piutang';

export function StockFinance() {
  const { token, user } = useStockStore();
  const [tab, setTab] = useState<Tab>('transactions');

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Laporan Keuangan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Ringkasan pemasukan, pengeluaran, laba rugi, dan stok
          </p>
        </div>
      </div>

      <div className="stock-subnav" style={{ display: 'flex', gap: '0.35rem', overflow: 'visible' }}>
        <button
          className={`finance-tab ${tab === 'transactions' ? 'finance-tab--active' : ''}`}
          onClick={() => setTab('transactions')}
        >
          <Package size={15} /> Transaksi
        </button>
        <button
          className={`finance-tab ${tab === 'summary' ? 'finance-tab--active' : ''}`}
          onClick={() => setTab('summary')}
        >
          <TrendingUp size={15} /> Ringkasan
        </button>
        <button
          className={`finance-tab ${tab === 'hutang' ? 'finance-tab--active' : ''}`}
          onClick={() => setTab('hutang')}
        >
          <CreditCard size={15} /> Hutang
        </button>
        <button
          className={`finance-tab ${tab === 'piutang' ? 'finance-tab--active' : ''}`}
          onClick={() => setTab('piutang')}
        >
          <DollarSign size={15} /> Piutang
        </button>
      </div>

      {tab === 'transactions' ? <TransactionsTab /> : tab === 'summary' ? <SummaryTab /> : tab === 'hutang' ? <StockHutang /> : <StockPiutang />}
    </div>
  );
}

function TransactionsTab() {
  const { token } = useStockStore();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'keluar', amount: '', description: '', customerName: '',
    category: '', channel: '',
  });
  const [activeChannels, setActiveChannels] = useState<string[]>(['offline', 'whatsapp']);
  const [saving, setSaving] = useState(false);
  const [showConfirmHapus, setShowConfirmHapus] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, preset: 'today' });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const settingsQuery = useQuery({
    queryKey: ['settings-channels', token],
    queryFn: () => stockApi.get<{ settings: { active_channels?: string[] } }>('/api/stock/settings', token!),
    enabled: !!token,
  });
  useEffect(() => {
    const ch = settingsQuery.data?.settings?.active_channels;
    if (ch) setActiveChannels(ch);
  }, [settingsQuery.data]);

  const params = new URLSearchParams({ page: String(page) });
  if (filterChannel) params.set('channel', filterChannel);
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (dateRange.startDate) params.set('start_date', dateRange.startDate);
  if (dateRange.endDate) params.set('end_date', dateRange.endDate);

  const pembukuanQuery = useQuery({
    queryKey: ['pembukuan', token, page, filterChannel, debouncedSearch, dateRange.startDate, dateRange.endDate],
    queryFn: () => stockApi.get<PembukuanData>(`/api/stock/pembukuan?${params}`, token!),
    enabled: !!token,
  });
  const data = pembukuanQuery.data;
  const loading = pembukuanQuery.isPending;

  const filteredCategories = CATEGORY_OPTIONS.filter(c => c.group === (form.type === 'keluar' ? 'expense' : 'income'));

  function openEdit(t: TransItem) {
    setEditingId(t.id);
    setForm({
      type: t.type,
      amount: String(t.amount),
      description: t.description,
      customerName: '',
      category: '',
      channel: t.channel || '',
    });
    setShowModal(true);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ type: 'keluar', amount: '', description: '', customerName: '', category: '', channel: '' });
    setShowModal(true);
  }

  async function save() {
    if (!token || saving) return;
    if (!form.description.trim()) { toast.error('Keterangan wajib diisi'); return; }
    const amount = parseFloat(form.amount.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
    if (amount <= 0) { toast.error('Jumlah harus lebih dari 0'); return; }
    if (!form.category && !editingId) { toast.error('Pilih kategori'); return; }
    setSaving(true);
    const body: Record<string, any> = {
      type: form.type === 'masuk' ? (form.category || 'modal') : (form.category || 'beban_operasional'),
      amount,
      description: form.description,
    };
    if (form.customerName.trim()) body.customerName = form.customerName.trim();
    if (form.channel) body.channel = form.channel;
    try {
      if (editingId) {
        await stockApi.put(`/api/stock/transactions/${editingId}`, token, { description: form.description });
        toast('Transaksi diupdate');
      } else {
        await stockApi.post('/api/stock/pembukuan', token, body);
        toast('Transaksi dicatat');
      }
      setShowModal(false);
      setForm({ type: 'keluar', amount: '', description: '', customerName: '', category: '', channel: '' });
      pembukuanQuery.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  async function hapus(id: string) {
    if (!token) return;
    try {
      await stockApi.del(`/api/stock/transactions/${id}`, token);
      toast('Transaksi dihapus');
      pembukuanQuery.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal hapus');
    }
  }

  const totalPages = data ? Math.ceil(data.total / Math.max(data.limit, 1)) || 1 : 1;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="grid grid-3" style={{ gap: '1rem', flex: 1 }}>
          <div className="card card-p">
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{loading ? <Skeleton width="120px" height="1.4rem" /> : fmtRp(data?.totalMasuk || 0)}</div>
            <div className="stat-label">Total Pemasukan</div>
          </div>
          <div className="card card-p">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{loading ? <Skeleton width="120px" height="1.4rem" /> : fmtRp(data?.totalKeluar || 0)}</div>
            <div className="stat-label">Total Pengeluaran</div>
          </div>
          <div className="card card-p">
            <div className="stat-value" style={{ color: loading ? 'var(--text-muted)' : (data && data.totalMasuk - data.totalKeluar >= 0 ? 'var(--primary)' : 'var(--danger)') }}>
              {loading ? <Skeleton width="120px" height="1.4rem" /> : fmtRp((data?.totalMasuk || 0) - (data?.totalKeluar || 0))}
            </div>
            <div className="stat-label">Saldo Bersih</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Catat Transaksi
          </button>
          <DownloadButton url="/api/stock/export/pembukuan" filename="Transaksi.xlsx" />
        </div>
      </div>

      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showChannel
        channel={filterChannel}
        onChannelChange={setFilterChannel}
        channels={activeChannels}
        showSearch
        search={searchText}
        onSearchChange={setSearchText}
      />

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : !data || data.transaksi.length === 0 ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada transaksi
        </div>
      ) : (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tipe</th>
                  <th>Keterangan</th>
                  <th>Channel</th>
                  <th>Jumlah</th>
                  <th style={{ width: 80 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.transaksi.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDateTime(t.created_at)}</td>
                    <td>
                      <span className={`badge ${t.type === 'masuk' ? 'badge-green' : 'badge-red'}`}>
                        {t.type === 'masuk' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.description}</div>
                      {t.products && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {t.products.name}
                        </div>
                      )}
                    </td>
                    <td>
                      {t.channel ? (
                        <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                          {t.channel}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                    <td style={{
                      fontWeight: 700,
                      color: t.type === 'masuk' ? 'var(--primary)' : 'var(--danger)',
                    }}>
                      {t.type === 'masuk' ? '+' : '-'}{fmtRp(t.amount)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(t)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} title="Hapus" onClick={() => setShowConfirmHapus(t.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={{ page, totalPages, total: data.total, limit: data.limit } as PaginationMeta} onPage={setPage} />
        </>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Transaksi' : 'Catat Transaksi Baru'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Tipe</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${form.type === 'keluar' ? 'btn-danger' : 'btn-ghost'}`}
                onClick={() => setForm({ ...form, type: 'keluar', category: '' })}
                style={form.type !== 'keluar' ? { border: '1px solid var(--border)' } : {}}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className={`btn btn-sm ${form.type === 'masuk' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setForm({ ...form, type: 'masuk', category: '' })}
                style={form.type !== 'masuk' ? { border: '1px solid var(--border)' } : {}}
              >
                Pemasukan
              </button>
            </div>
          </div>

          {!editingId && (
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">— Pilih kategori —</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Jumlah (Rp)</label>
            <RupiahInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="Misal: bayar listrik" />
          </div>

          {(form.category === 'piutang' || form.category === 'hutang_dagang') && (
            <div className="form-group">
              <label className="form-label">
                {form.category === 'piutang' ? 'Nama Pelanggan' : 'Nama Supplier'}
              </label>
              <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Nama" />
            </div>
          )}

          {form.type !== 'keluar' && (
            <div className="form-group">
              <label className="form-label">Channel</label>
              <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="">— Tanpa channel —</option>
                {activeChannels.map((ch) => {
                  const tmpl = CHANNEL_TEMPLATES[ch];
                  return (
                    <option key={ch} value={ch}>
                      {tmpl ? tmpl.label : ch.replace('custom_', '').replace(/_/g, ' ')}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={!!showConfirmHapus}
        title="Hapus Transaksi"
        message="Yakin hapus transaksi ini? Stok akan dikembalikan jika ada."
        confirmLabel="Hapus"
        danger
        onConfirm={() => { if (showConfirmHapus) { hapus(showConfirmHapus); setShowConfirmHapus(null); } }}
        onCancel={() => setShowConfirmHapus(null)}
      />
    </>
  );
}

function SummaryTab() {
  const { token, user } = useStockStore();
  const [days, setDays] = useState(30);

  const labaQuery = useQuery({
    queryKey: ['laba-rugi', token, days],
    queryFn: () => stockApi.get<LabaRugiData>(`/api/stock/laba-rugi?days=${days}&channel=`, token!),
    enabled: !!token,
    staleTime: 30_000,
  });
  const trialQuery = useQuery({
    queryKey: ['trial-balance', token],
    queryFn: () => stockApi.get<TrialBalanceData>('/api/stock/trial-balance', token!),
    enabled: !!token,
    staleTime: 30_000,
  });
  const summaryQuery = useQuery({
    queryKey: ['summary', token],
    queryFn: () => stockApi.get<StockSummaryData>('/api/stock/summary', token!),
    enabled: !!token,
    staleTime: 30_000,
  });

  const loading = labaQuery.isPending || trialQuery.isPending || summaryQuery.isPending;
  const labaData = labaQuery.data ?? null;
  const trialData = trialQuery.data ?? null;
  const summaryData = summaryQuery.data ?? null;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="grid grid-3" style={{ gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
      </div>
      <div className="card card-p"><Skeleton count={4} /></div>
    </div>
  );

  if (user?.status === 'demo') {
    return (
      <div className="card card-p" style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: 480, margin: '2rem auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ringkasan Keuangan</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Fitur ini hanya tersedia untuk pengguna PRO.
        </p>
        <a
          href="https://wa.me/6283121376756?text=Halo%20saya%20ingin%20upgrade%20Tata%20Business%20Suite%20ke%20PRO"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          Upgrade ke PRO
        </a>
      </div>
    );
  }

  const isProfit = labaData ? labaData.labaBersih >= 0 : true;
  const totalBalance = trialData ? Math.abs(trialData.rows.reduce((s, r) => s + r.debit, 0) - trialData.rows.reduce((s, r) => s + r.credit, 0)) < 1 : true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Laba Rugi</h3>
        </div>
        <div className="period-bar" style={{ display: 'flex', gap: '0.25rem' }}>
          {periods.map(p => (
            <button key={p.days} className={`period-btn${days === p.days ? ' active' : ''}`} onClick={() => setDays(p.days)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: '1rem' }}>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{labaData ? fmtRp(labaData.totalRevenue) : '-'}</div>
          <div className="stat-label">Pendapatan</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{labaData ? fmtRp(labaData.totalCOGS + labaData.totalExpense) : '-'}</div>
          <div className="stat-label">Total Biaya</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: labaData && labaData.labaKotor >= 0 ? 'var(--secondary)' : 'var(--danger)' }}>
            {labaData ? fmtRp(labaData.labaKotor) : '-'}
          </div>
          <div className="stat-label">Laba Kotor</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: isProfit ? 'var(--primary)' : 'var(--danger)' }}>
            {labaData ? fmtRp(labaData.labaBersih) : '-'}
            {labaData && (isProfit ? <TrendingUp size={16} style={{ marginLeft: 4, verticalAlign: 'middle' }} /> : <TrendingDown size={16} style={{ marginLeft: 4, verticalAlign: 'middle' }} />)}
          </div>
          <div className="stat-label">Laba Bersih</div>
        </div>
      </div>

      {summaryData && (
        <>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.5rem' }}>Inventori</h3>
          <div className="grid grid-4" style={{ gap: '1rem' }}>
            <div className="card card-p">
              <div className="stat-value">{summaryData.total}</div>
              <div className="stat-label">Total Produk</div>
            </div>
            <div className="card card-p">
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(summaryData.totalValue)}</div>
              <div className="stat-label">Nilai Inventori</div>
            </div>
            <div className="card card-p">
              <div className="stat-value" style={{ color: summaryData.lowStock > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                {summaryData.lowStock}
              </div>
              <div className="stat-label">Stok Menipis</div>
            </div>
            <div className="card card-p">
              <div className="stat-value" style={{ color: summaryData.outStock > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                {summaryData.outStock}
              </div>
              <div className="stat-label">Stok Habis</div>
            </div>
          </div>

          {Object.entries(summaryData.byCategory).length > 0 && (
            <div className="card card-p">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                <Package size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                Inventori per Kategori
              </h3>
              {(() => {
                const entries = Object.entries(summaryData.byCategory).sort((a, b) => b[1].value - a[1].value);
                const maxVal = entries[0][1].value;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {entries.map(([cat, info]) => (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 600 }}>{cat}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {info.count} produk · {fmtRp(info.value)}
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${(info.value / maxVal) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {summaryData.alerts.length > 0 && (
            <div className="card card-p" style={{ borderLeft: '3px solid var(--warning)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                <AlertTriangle size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                Peringatan Stok ({summaryData.alerts.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {summaryData.alerts.map(a => (
                  <div key={a.id} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      {a.products?.name || `Produk #${a.product_id}`}
                      {a.alert_type === 'out_of_stock' ? ' — Stok Habis' : ' — Stok Menipis'}
                    </span>
                    <Badge variant={a.alert_type === 'out_of_stock' ? 'habis' : 'menipis'}>
                      {a.alert_type === 'out_of_stock' ? 'Habis' : `${fmtQty(a.stock_level, a.products?.unit)} tersisa`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {trialData && trialData.rows.length > 0 && (
        <div className="card card-p">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              <Info size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
              Verifikasi Neraca
            </h3>
            <div style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem', borderRadius: 6, background: totalBalance ? 'var(--primary-light, #d1fae5)' : 'var(--danger-light, #fee2e2)', color: totalBalance ? 'var(--primary)' : 'var(--danger)' }}>
              {totalBalance ? '✓ Balance' : '✗ Tidak Balance'}
            </div>
          </div>
          <div className="tbl-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Akun</th>
                  <th>Tipe</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Kredit</th>
                </tr>
              </thead>
              <tbody>
                {trialData.rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.code}</td>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td><span className="badge badge-gray">{row.type}</span></td>
                    <td style={{ textAlign: 'right', color: row.debit > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                      {row.debit > 0 ? fmtRp(row.debit) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: row.credit > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                      {row.credit > 0 ? fmtRp(row.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
