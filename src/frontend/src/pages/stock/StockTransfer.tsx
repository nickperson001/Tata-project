import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton, TableSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { fmtRp, fmtDate } from '../../lib/utils';
import type { Product, Warehouse } from '../../types';
import { ArrowLeftRight, Plus } from 'lucide-react';

interface TransferItem {
  id: string;
  created_at: string;
  product_id: string;
  quantity: number;
  note: string;
  from_warehouse: string;
  to_warehouse: string;
  products?: { id: string; sku: string; name: string; unit: string };
}

export function StockTransfer() {
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
  const prodLoading = productsQuery.isPending;
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productId: '', fromWarehouse: '', toWarehouse: '', quantity: '', notes: '',
  });

  const listQuery = useQuery({
    queryKey: ['transfers', token],
    queryFn: () => stockApi.get<TransferItem[]>('/api/stock/transfers', token!),
    enabled: !!token,
  });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses', token],
    queryFn: () => stockApi.get<Warehouse[]>('/api/stock/warehouses', token!),
    enabled: !!token,
  });

  const list = listQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const loading = listQuery.isPending || prodLoading || warehousesQuery.isPending;

  function openCreate() {
    setForm({ productId: '', fromWarehouse: '', toWarehouse: '', quantity: '', notes: '' });
    setShowModal(true);
  }

  async function save() {
    if (!token) return;
    if (form.fromWarehouse === form.toWarehouse) {
      toast.error('Gudang asal dan tujuan harus berbeda');
      return;
    }
    setSaving(true);
    try {
      await stockApi.post('/api/stock/transfer', token, {
        productId: form.productId,
        quantity: Number(form.quantity),
        fromWarehouse: form.fromWarehouse,
        toWarehouse: form.toWarehouse,
        notes: form.notes || undefined,
      });
      toast('Transfer berhasil');
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Transfer Gudang</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Pindahkan stok antar gudang</p>
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Transfer Gudang</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Pindahkan stok antar gudang</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={16} /> Transfer Baru
        </button>
      </div>

      {list.length > 0 && (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Produk</th>
                <th>Jumlah</th>
                <th>Dari</th>
                <th>Ke</th>
                <th>Catatan</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.products?.name || `#${item.product_id}`}</td>
                  <td>{item.quantity}</td>
                  <td style={{ fontSize: '0.85rem' }}>{item.from_warehouse}</td>
                  <td style={{ fontSize: '0.85rem' }}>{item.to_warehouse}</td>
                  <td style={{ fontSize: '0.8rem' }}>{item.note || '-'}</td>
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
        title="Transfer Stok Antar Gudang"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Transfer'}
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
                <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stok: {p.stock_current}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dari Gudang</label>
              <select className="input" value={form.fromWarehouse} onChange={(e) => setForm({ ...form, fromWarehouse: e.target.value })} required>
                <option value="">-- Pilih --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.name}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ke Gudang</label>
              <select className="input" value={form.toWarehouse} onChange={(e) => setForm({ ...form, toWarehouse: e.target.value })} required>
                <option value="">-- Pilih --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.name}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Jumlah</label>
            <input className="input" type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan (opsional)</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Misal: restok gudang cabang" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
