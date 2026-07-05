import { useEffect, useState, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton, TableSkeleton } from '../../components/LoadingSkeleton';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { FilterBar } from '../../components/FilterBar';
import type { DateRange } from '../../components/DateRangeFilter';
import { toast } from '../../components/Toast';
import { fmtRp, fmtDateTime } from '../../lib/utils';
import type { PaginationMeta } from '../../types';
import type { TransItem, PembukuanData, ApiResponse } from '../../types/api';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { DownloadButton } from '../../components/DownloadButton';

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

export function StockPembukuan() {
  const { token } = useStockStore();
  const [data, setData] = useState<PembukuanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'keluar', amount: '', description: '', customerName: '',
    category: '', channel: '',
  });
  const [activeChannels, setActiveChannels] = useState<string[]>(['offline', 'whatsapp']);
  const [showConfirmHapus, setShowConfirmHapus] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState('');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, preset: 'today' });

  useEffect(() => {
    if (!token) return;
    stockApi.get<{ settings: any }>('/api/stock/settings', token)
      .then((d) => {
        if (d.settings?.active_channels) setActiveChannels(d.settings.active_channels);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : '[StockPembukuan] Fetch transaksi gagal'));
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filterChannel) params.set('channel', filterChannel);
      if (searchText) params.set('search', searchText);
      if (dateRange.startDate) params.set('start_date', dateRange.startDate);
      if (dateRange.endDate) params.set('end_date', dateRange.endDate);
      const d = await stockApi.get<PembukuanData>(`/api/stock/pembukuan?${params}`, token);
      setData(d);
    } catch {
      toast.error('Gagal muat pembukuan');
    } finally {
      setLoading(false);
    }
  }, [token, page, filterChannel, searchText, dateRange.startDate, dateRange.endDate]);

  useEffect(() => { load(); }, [load]);

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
    if (!token) return;
    const body: Record<string, any> = {
      type: form.type === 'masuk' ? (form.category || 'modal') : (form.category || 'beban_operasional'),
      amount: Number(form.amount),
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
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    }
  }

  async function hapus(id: string) {
    if (!token) return;
    try {
      await stockApi.del(`/api/stock/transactions/${id}`, token);
      toast('Transaksi dihapus');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal hapus');
    }
  }

  const totalPages = data ? Math.ceil(data.total / Math.max(data.limit, 1)) || 1 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Pembukuan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Catatan keuangan & jurnal</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Catat Transaksi
          </button>
          <DownloadButton url="/api/stock/export/pembukuan" filename="Pembukuan.xlsx" />
        </div>
      </div>

      <div className="grid grid-3" style={{ gap: '1rem' }}>
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
          <Pagination meta={{ page, totalPages, total: data.total, limit: data.limit }} onPage={setPage} />
        </>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Transaksi' : 'Catat Transaksi Baru'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save}>Simpan</button>
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
              <label className="form-label">Kategori Akun</label>
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
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Kategori menentukan akun di Buku Besar
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Jumlah (Rp)</label>
            <input className="input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="Misal: bayar listrik" />
          </div>

          {form.category === 'piutang' && (
            <div className="form-group">
              <label className="form-label">Nama Pelanggan</label>
              <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Nama customer" />
            </div>
          )}
          {(form.category === 'hutang_dagang' || form.category === 'hutang_lancar') && (
            <div className="form-group">
              <label className="form-label">Nama Supplier</label>
              <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Nama supplier" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Channel Penjualan</label>
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
    </div>
  );
}
