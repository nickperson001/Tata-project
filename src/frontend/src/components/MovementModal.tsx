import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../store/stockStore';
import { stockApi } from '../services/api';
import { toast } from './Toast';
import { Modal } from './Modal';
import type { Product } from '../types';
import { Package, ShoppingCart, Car, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { fmtRp } from '../lib/utils';

const TYPE_BUTTONS = [
  { value: 'in', label: 'Stok Masuk', icon: ShoppingCart, color: 'var(--primary)' },
  { value: 'out', label: 'Stok Keluar', icon: Car, color: 'var(--danger)' },
  { value: 'adjustment', label: 'Penyesuaian', icon: AlertTriangle, color: 'var(--warning)' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialType?: 'in' | 'out' | 'adjustment';
  productId?: string;
}

export function MovementModal({ open, onClose, onSuccess, initialType, productId }: Props) {
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
  const [form, setForm] = useState({ product_id: '', type: 'in' as 'in' | 'out' | 'adjustment', quantity: '', note: '', channel: '' });
  const [activeChannels, setActiveChannels] = useState<string[]>(['offline', 'whatsapp', 'shopee', 'tokopedia']);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [noteTouched, setNoteTouched] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['settings', token],
    queryFn: () => stockApi.get<{ settings: any }>('/api/stock/settings', token!),
    enabled: !!token,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (settingsQuery.data?.settings?.active_channels) setActiveChannels(settingsQuery.data.settings.active_channels);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (initialType) setForm(prev => ({ ...prev, type: initialType }));
  }, [initialType]);

  useEffect(() => {
    if (productId && products.length > 0) {
      const prod = products.find(p => p.id === productId);
      if (prod) {
        setSelectedProduct(prod);
        setForm(prev => ({ ...prev, product_id: productId, channel: prod.default_channel || '' }));
      }
    }
  }, [productId, products]);

  useEffect(() => {
    if (noteTouched) return;
    const labels: Record<string, string> = { in: 'Stok masuk', out: 'Stok keluar', adjustment: 'Penyesuaian stok' };
    setForm((prev) => ({ ...prev, note: labels[prev.type] || '' }));
  }, [form.type, noteTouched]);

  function handleNoteChange(value: string) {
    setNoteTouched(true);
    setForm((prev) => ({ ...prev, note: value }));
  }

  function handleProductChange(id: string) {
    const prod = products.find(p => p.id === id) || null;
    setSelectedProduct(prod);
    setForm(prev => ({ ...prev, product_id: id, channel: prod?.default_channel || '' }));
  }

  function resetForm() {
    setForm({ product_id: '', type: 'in', quantity: '', note: '', channel: '' });
    setSelectedProduct(null);
    setNoteTouched(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || saving || !form.product_id || !form.quantity) {
      toast.error('Lengkapi form');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        product_id: form.product_id,
        type: form.type,
        quantity: Number(form.quantity),
        note: form.note || undefined,
      };
      if (form.channel) body.channel = form.channel;
      await stockApi.post('/api/stock/movement', token, body);
      toast('Stok berhasil dicatat');
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Catat Pergerakan Stok" large>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Produk</label>
          <select
            className="input"
            value={form.product_id}
            onChange={(e) => handleProductChange(e.target.value)}
            required
          >
            <option value="">-- Pilih Produk --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — Stok: {p.stock_current} {p.unit || ''}
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Harga Beli: </span>
              <strong>{fmtRp(selectedProduct.price_buy || 0)}</strong>
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Harga Jual: </span>
              <strong>{fmtRp(selectedProduct.price_sell)}</strong>
            </div>
            {selectedProduct.default_channel && (
              <div style={{ fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Channel: </span>
                <strong>{selectedProduct.default_channel}</strong>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Tipe</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TYPE_BUTTONS.map((btn) => (
              <button
                key={btn.value}
                type="button"
                className={`btn btn-sm ${form.type === btn.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setForm(prev => ({ ...prev, type: btn.value as any }))}
                style={form.type === btn.value ? { background: btn.color, border: 'none' } : { border: '1px solid var(--border)' }}
              >
                <btn.icon size={16} />
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Jumlah</label>
            <input className="input" type="number" min="0" step="any" value={form.quantity}
              onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))} required placeholder="0" />
          </div>
          {form.type === 'out' && (
            <div className="form-group">
              <label className="form-label">Channel</label>
              <select className="input" value={form.channel} onChange={(e) => setForm(prev => ({ ...prev, channel: e.target.value }))}>
                <option value="">— Default —</option>
                {activeChannels.map((ch) => (
                  <option key={ch} value={ch}>{ch.charAt(0).toUpperCase() + ch.slice(1)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Catatan</label>
          <input className="input" value={form.note} onChange={(e) => handleNoteChange(e.target.value)} placeholder="Otomatis: Stok masuk / Stok keluar" />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
          <ArrowUpDown size={18} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {form.type === 'in' ? 'Stok akan bertambah' : form.type === 'out' ? 'Stok akan berkurang' : 'Stok akan disesuaikan'}
          </span>
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%' }}>
          <Package size={16} />
          {saving ? 'Menyimpan...' : 'Catat Pergerakan Stok'}
        </button>
      </form>
    </Modal>
  );
}
