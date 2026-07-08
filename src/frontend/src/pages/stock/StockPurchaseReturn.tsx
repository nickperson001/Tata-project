import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { useProducts } from '../../hooks/useProducts';
import { stockApi } from '../../services/api';
import { Skeleton, TableSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtDate } from '../../lib/utils';
import type { ReturnTransaction } from '../../types';
import { Undo2, Plus } from 'lucide-react';

export function StockPurchaseReturn() {
  const { token } = useStockStore();
  const { data: products = [] } = useProducts();
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productId: '', originalTransactionId: '', quantity: '',
    returnReason: '', statusBayar: 'tunai' as 'tunai' | 'hutang',
    priceBuy: '',
  });

  const listQuery = useQuery({
    queryKey: ['returns-purchase', token],
    queryFn: () => stockApi.get<ReturnTransaction[]>('/api/stock/returns?type=purchase_return', token!),
    enabled: !!token,
  });

  const list = listQuery.data ?? [];
  const loading = listQuery.isPending;

  function openCreate() {
    setForm({ productId: '', originalTransactionId: '', quantity: '', returnReason: '', statusBayar: 'tunai', priceBuy: '' });
    setShowModal(true);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      await stockApi.post('/api/stock/return/purchase', token, {
        productId: form.productId,
        originalTransactionId: form.originalTransactionId,
        quantity: Number(form.quantity),
        returnReason: form.returnReason,
        statusBayar: form.statusBayar,
        priceBuy: Number(form.priceBuy) || 0,
      });
      toast('Retur pembelian dicatat');
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Retur Pembelian</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Catat retur barang ke supplier</p>
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Retur Pembelian</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Catat retur barang ke supplier</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={16} /> Retur Baru
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada retur pembelian
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
        title="Catat Retur Pembelian"
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
              <label className="form-label">Harga Beli (Rp)</label>
              <input className="input" type="number" min="0" value={form.priceBuy} onChange={(e) => setForm({ ...form, priceBuy: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Alasan Retur</label>
            <input className="input" value={form.returnReason} onChange={(e) => setForm({ ...form, returnReason: e.target.value })} placeholder="Misal: barang cacat" required />
          </div>
          <div className="form-group">
            <label className="form-label">Status Bayar</label>
            <select className="input" value={form.statusBayar} onChange={(e) => setForm({ ...form, statusBayar: e.target.value as 'tunai' | 'hutang' })}>
              <option value="tunai">Tunai (refund)</option>
              <option value="hutang">Hutang (kurangi hutang)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
