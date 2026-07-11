import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton, TableSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { RupiahInput } from '../../components/RupiahInput';
import { toast } from '../../components/Toast';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtDate } from '../../lib/utils';
import type { Product, ReturnTransaction } from '../../types';
import { Undo2, Plus } from 'lucide-react';

export function StockReturn() {
  const { token } = useStockStore();
  const productsQuery = useQuery({
    queryKey: ['products', token],
    queryFn: () => stockApi.get<{ products: Product[] }>('/api/stock/products?limit=500', token!),
    enabled: !!token,
    staleTime: 60_000,
    gcTime: 120_000,
    select: (data) => data.products,
  });
  const products = productsQuery.data ?? [];
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productId: '', originalTransactionId: '', quantity: '',
    returnReason: '', statusBayar: 'tunai' as 'tunai' | 'piutang',
    priceSell: '', channel: '',
  });

  const listQuery = useQuery({
    queryKey: ['returns-sales', token],
    queryFn: () => stockApi.get<ReturnTransaction[]>('/api/stock/returns?type=sales_return', token!),
    enabled: !!token,
  });

  const list = listQuery.data ?? [];
  const loading = listQuery.isPending;

  function openCreate() {
    setForm({ productId: '', originalTransactionId: '', quantity: '', returnReason: '', statusBayar: 'tunai', priceSell: '', channel: '' });
    setShowModal(true);
  }

  async function save() {
    if (!token || saving) return;
    setSaving(true);
    try {
      await stockApi.post('/api/stock/return/sales', token, {
        productId: form.productId,
        originalTransactionId: form.originalTransactionId,
        quantity: Number(form.quantity),
        returnReason: form.returnReason,
        statusBayar: form.statusBayar,
        priceSell: Number(form.priceSell) || 0,
        priceBuy: 0,
        channel: form.channel || undefined,
      });
      toast('Retur penjualan dicatat');
      setShowModal(false);
      listQuery.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Retur Penjualan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Catat retur barang dari pelanggan</p>
        </div>
        <Skeleton width="130px" height="2rem" />
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Retur Penjualan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Catat retur barang dari pelanggan</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={16} /> Retur Baru
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada retur penjualan
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Jumlah</th>
                <th>Nilai</th>
                <th>Alasan</th>
                <th>Status</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.products?.name || `#${item.product_id}`}</td>
                  <td>{item.quantity}</td>
                  <td style={{ fontWeight: 700 }}>{fmtRp(item.amount)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{item.description || '-'}</td>
                  <td><Badge variant={item.status === 'completed' ? 'lunas' : 'belum'}>{item.status}</Badge></td>
                  <td style={{ fontSize: '0.8rem' }}>{fmtDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Catat Retur Penjualan"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Produk</label>
            <select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
              <option value="">-- Pilih Produk --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ID Transaksi Original</label>
            <input className="input" value={form.originalTransactionId} onChange={(e) => setForm({ ...form, originalTransactionId: e.target.value })} placeholder="ID transaksi yang diretur" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Jumlah</label>
              <input className="input" type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Harga Jual (Rp)</label>
              <RupiahInput value={form.priceSell} onChange={(v) => setForm({ ...form, priceSell: v })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Alasan Retur</label>
            <input className="input" value={form.returnReason} onChange={(e) => setForm({ ...form, returnReason: e.target.value })} placeholder="Misal: barang rusak" required />
          </div>
          <div className="form-group">
            <label className="form-label">Status Bayar</label>
            <select className="input" value={form.statusBayar} onChange={(e) => setForm({ ...form, statusBayar: e.target.value as 'tunai' | 'piutang' })}>
              <option value="tunai">Tunai (refund)</option>
              <option value="piutang">Piutang</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Channel (opsional)</label>
            <input className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
