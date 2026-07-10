import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../store/stockStore';
import { stockApi } from '../services/api';
import { Modal } from './Modal';
import { RupiahInput } from './RupiahInput';
import { toast } from './Toast';
import type { Product } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReturnModal({ open, onClose, onSuccess }: Props) {
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
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productId: '', originalTransactionId: '', quantity: '',
    returnReason: '', statusBayar: 'tunai' as 'tunai' | 'piutang',
    priceSell: '', channel: '',
  });

  function resetForm() {
    setForm({ productId: '', originalTransactionId: '', quantity: '', returnReason: '', statusBayar: 'tunai', priceSell: '', channel: '' });
  }

  async function save() {
    if (!token) return;
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
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catat Retur Penjualan"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
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
  );
}
