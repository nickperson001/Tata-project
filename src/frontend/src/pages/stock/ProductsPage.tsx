import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Modal } from '../../components/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Badge } from '../../components/Badge';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { toast } from '../../components/Toast';
import { fmtRp, fmtQty } from '../../lib/utils';
import type { Product } from '../../types';
import { Plus, Edit2, Trash2, Search, Globe, AlertTriangle, RefreshCw } from 'lucide-react';
import { DownloadButton } from '../../components/DownloadButton';

interface Category {
  id: string;
  name: string;
}

export function ProductsPage() {
  const { token } = useStockStore();
  const user = useStockStore(s => s.user);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ sku: '', name: '', category: '', unit: '', price_buy: '', price_sell: '', stock_min: '', default_channel: '' });

  const productsQuery = useQuery({
    queryKey: ['products-page', token],
    queryFn: () => stockApi.get<{ products: Product[] }>('/api/stock/products', token!),
    enabled: !!token,
    staleTime: 30_000,
    gcTime: 60_000,
    select: (data) => data.products ?? [],
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', token],
    queryFn: () => stockApi.get<{ categories: Category[] }>('/api/stock/categories', token!),
    enabled: !!token,
    staleTime: 60_000,
    select: (data) => data.categories ?? [],
  });

  const channelsQuery = useQuery({
    queryKey: ['settings-channels', token],
    queryFn: () => stockApi.get<{ settings?: { active_channels?: string[] } }>('/api/stock/settings', token!),
    enabled: !!token,
    staleTime: 60_000,
    select: (data) => data.settings?.active_channels ?? ['offline', 'whatsapp', 'shopee', 'tokopedia', 'lazada', 'tiktok shop'],
  });

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const activeChannels = channelsQuery.data ?? [];
  const loading = productsQuery.isPending || categoriesQuery.isPending || channelsQuery.isPending;
  const error = productsQuery.isError || categoriesQuery.isError || channelsQuery.isError;

  const isDemo = user?.status === 'demo';
  const demoLimitReached = isDemo && products.length >= 3;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditProduct(null);
    setForm({ sku: '', name: '', category: '', unit: '', price_buy: '', price_sell: '', stock_min: '', default_channel: '' });
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setForm({
      sku: p.sku,
      name: p.name,
      category: p.category || '',
      unit: p.unit || '',
      price_buy: p.price_buy?.toString() || '',
      price_sell: p.price_sell.toString(),
      stock_min: p.stock_min?.toString() || '',
      default_channel: p.default_channel || '',
    });
    setShowModal(true);
  }

  async function save() {
    if (!token) return;
    const body: Record<string, unknown> = {
      sku: form.sku,
      name: form.name,
      category: form.category || undefined,
      unit: form.unit || undefined,
      price_buy: form.price_buy ? Number(form.price_buy) : undefined,
      price_sell: Number(form.price_sell),
      stock_min: form.stock_min ? Number(form.stock_min) : undefined,
      default_channel: form.default_channel || undefined,
    };

    try {
      if (editProduct) {
        await stockApi.put(`/api/stock/products/${editProduct.id}`, token, body);
        toast('Produk diupdate');
      } else {
        await stockApi.post('/api/stock/products', token, body);
        toast('Produk dibuat');
      }
      setShowModal(false);
      productsQuery.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal simpan produk');
    }
  }

  async function confirmDelete(id: string) {
    try {
      await stockApi.del(`/api/stock/products/${id}`, token!);
      toast('Produk dihapus');
      productsQuery.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal hapus produk');
    }
  }

  function stockStatus(stock: number, min: number | null): string {
    if (stock <= 0) return 'habis';
    if (min && stock <= min) return 'menipis';
    return 'aman';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Produk</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Kelola produk Anda</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={openCreate}
            disabled={demoLimitReached}
            title={demoLimitReached ? 'Demo terbatas 3 produk. Upgrade ke PRO!' : ''}
            style={demoLimitReached ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            <Plus size={16} /> Tambah Produk
          </button>
          <DownloadButton url="/api/stock/export/produk" filename="ProdukStok.xlsx" />
        </div>
        {isDemo && (
          <div style={{
            width: '100%', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600,
            background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '0.5rem 0.75rem',
          }}>
            🔒 Demo: maksimal 3 produk. {products.length}/3 digunakan.
            <a href="https://wa.me/6283121376756?text=Halo%20saya%20ingin%20upgrade%20Tata%20Business%20Suite%20ke%20PRO"
               target="_blank" rel="noopener noreferrer"
               style={{ marginLeft: '0.5rem', fontWeight: 700, color: 'var(--warning)' }}>
               Upgrade →
            </a>
          </div>
        )}
      </div>

      <div style={{ position: 'relative', maxWidth: 300 }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          className="input input-sm"
          placeholder="Cari nama/SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '2rem' }}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : error ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', borderColor: 'var(--danger)', borderWidth: 2 }}>
          <AlertTriangle size={36} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Gagal Memuat Data</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 1rem' }}>
            Server penyimpanan data sedang tidak dapat dijangkau. Silakan coba lagi.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => productsQuery.refetch()}>
            <RefreshCw size={14} /> Coba Lagi
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          {products.length === 0 ? 'Belum ada produk. Klik "Tambah Produk" untuk memulai.' : 'Tidak ditemukan'}
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Channel</th>
                <th>Harga Beli</th>
                <th>Stok</th>
                <th>Harga Jual</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.sku}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.category || '-'}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {p.default_channel ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(34,197,94,0.1)', color: 'var(--success)', borderRadius: 4, padding: '0.15rem 0.4rem' }}>
                        <Globe size={12} /> {p.default_channel}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Semua</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: (p.price_buy ?? 0) === 0 ? 'var(--danger)' : 'var(--text)', fontSize: '0.8rem' }}>
                    {fmtRp(p.price_buy ?? 0)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="progress" style={{ width: 80 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(((p.stock_current ?? 0) / Math.max(p.stock_min || 10, 1)) * 100, 100)}%`,
                            background: (p.stock_current ?? 0) <= 0 ? 'var(--danger)' : (p.stock_min && (p.stock_current ?? 0) <= p.stock_min ? 'var(--warning)' : 'var(--primary)'),
                          }}
                        />
                      </div>
                      {fmtQty(p.stock_current, p.unit)}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtRp(p.price_sell)}</td>
                  <td>
                    <Badge variant={stockStatus(p.stock_current, p.stock_min)}>
                      {stockStatus(p.stock_current, p.stock_min) === 'aman' ? 'Aman' : stockStatus(p.stock_current, p.stock_min) === 'menipis' ? 'Menipis' : 'Habis'}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmId(p.id)} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editProduct ? 'Edit Produk' : 'Tambah Produk'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SKU</label>
              <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nama Produk</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— Pilih kategori —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Satuan</label>
              <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg, dll" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Harga Beli</label>
              <input className="input" type="number" value={form.price_buy} onChange={(e) => setForm({ ...form, price_buy: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Harga Jual</label>
              <input className="input" type="number" value={form.price_sell} onChange={(e) => setForm({ ...form, price_sell: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Channel Default</label>
            <select className="input" value={form.default_channel} onChange={(e) => setForm({ ...form, default_channel: e.target.value })}>
              <option value="">— Semua channel —</option>
              {activeChannels.map((ch) => (
                <option key={ch} value={ch}>{ch.charAt(0).toUpperCase() + ch.slice(1)}</option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Channel utama penjualan produk ini</span>
          </div>
          <div className="form-group">
            <label className="form-label">Stok Minimal</label>
            <input className="input" type="number" value={form.stock_min} onChange={(e) => setForm({ ...form, stock_min: e.target.value })} placeholder="Untuk peringatan stok menipis" />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteConfirmId}
        title="Hapus Produk"
        message="Yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        danger
        onConfirm={() => {
          if (deleteConfirmId) confirmDelete(deleteConfirmId);
          setDeleteConfirmId(null);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
