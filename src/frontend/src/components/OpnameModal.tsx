import { useEffect, useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../store/stockStore';
import { stockApi } from '../services/api';
import { toast } from './Toast';
import { Modal } from './Modal';
import { fmtQty } from '../lib/utils';
import type { Product } from '../types';
import { Camera, X, Save, AlertCircle, Search, Filter } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DRAFT_KEY = 'tbs_opname_draft';

export function OpnameModal({ open, onClose, onSuccess }: Props) {
  const { token } = useStockStore();
  const [actual, setActual] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [search, setSearch] = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const productsQuery = useQuery({
    queryKey: ['opname-products', token],
    queryFn: () => stockApi.get<{ products: Product[] }>('/api/stock/products?limit=500', token!),
    enabled: !!token && open,
    staleTime: 30_000,
    gcTime: 60_000,
    select: (data) => {
      const list = data.products ?? data ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  const products = productsQuery.data ?? [];

  useEffect(() => {
    if (!products.length) return;
    const draft = sessionStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft) as Record<string, string>;
        setActual(parsed);
        return;
      } catch { /* ignore */ }
    }
    const init: Record<string, string> = {};
    products.forEach((p: Product) => { init[p.id] = p.stock_current.toString(); });
    setActual(init);
  }, [products]);

  useEffect(() => {
    if (!open) {
      setActual({});
      setShowScanner(false);
      setScannerError('');
      setSearch('');
      setShowDiffOnly(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (open && Object.keys(actual).length > 0) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(actual));
    }
  }, [actual, open]);

  function scanFeedback() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      osc.type = 'sine';
      gain.gain.value = 0.15;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 120);
    } catch { /* silent fail */ }
    if (navigator.vibrate) navigator.vibrate(50);
  }

  useEffect(() => {
    if (!showScanner || !open) {
      setScannerError('');
      return;
    }
    setScannerError('');
    const scanner = new Html5QrcodeScanner(
      'opname-reader',
      { qrbox: { width: 250, height: 250 }, fps: 5 },
      false,
    );
    scannerRef.current = scanner;
    scanner.render(
      (text) => {
        const product = products.find(p => p.sku === text);
        if (product) {
          scanFeedback();
          toast.success(`Berhasil scan: ${product.name}`);
          const el = document.getElementById(`opname-input-${product.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }
          scanner.clear();
          setShowScanner(false);
        } else {
          toast.error(`SKU ${text} tidak ditemukan`);
        }
      },
      (err) => {
        if (err?.includes('NotAllowedError') || err?.includes('Permission')) {
          setScannerError('Akses kamera ditolak. Izinkan akses kamera di pengaturan browser.');
        }
      },
    );
    return () => { scanner.clear().catch(() => {}); };
  }, [showScanner, open, products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (showDiffOnly) {
      list = list.filter(p => {
        const d = (parseFloat(actual[p.id]) || 0) - p.stock_current;
        return d !== 0;
      });
    }
    return list;
  }, [products, search, showDiffOnly, actual]);

  function diff(id: string): number {
    const p = products.find((x) => x.id === id);
    if (!p) return 0;
    return (parseFloat(actual[id]) || 0) - p.stock_current;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    try {
      let count = 0;
      for (const product of products) {
        const systemQty = product.stock_current;
        const actualQty = parseFloat(actual[product.id]) || 0;
        if (actualQty === systemQty) continue;
        const diff = actualQty - systemQty;
        try {
          await stockApi.post('/api/stock/movement', token, {
            product_id: product.id,
            type: diff > 0 ? 'in' : 'out',
            quantity: Math.abs(diff),
            channel: product.default_channel || '',
            note: `Opname: sistem ${systemQty}, fisik ${actualQty} (${diff > 0 ? 'lebih' : 'kurang'} ${Math.abs(diff)})`,
          });
          count++;
        } catch {
          toast.error(`Gagal opname ${product.name}`);
        }
      }
      sessionStorage.removeItem(DRAFT_KEY);
      toast(`${count} produk diupdate`);
      onSuccess?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Opname Stok"
      size="lg"
      footer={
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={`btn ${showScanner ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setShowScanner(!showScanner)} type="button">
            {showScanner ? <X size={14} /> : <Camera size={14} />}
            {showScanner ? 'Tutup Scanner' : 'Scan Barcode'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose} type="button">Batal</button>
          <button className="btn btn-primary" type="submit" form="opname-form" disabled={saving}>
            <Save size={14} />
            {saving ? 'Menyimpan...' : 'Simpan Opname'}
          </button>
        </div>
      }
    >
      {showScanner && (
        <div className="card card-p" style={{ maxWidth: 400, margin: '0 auto 1rem' }}>
          <div id="opname-reader"></div>
          {scannerError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              marginTop: '0.75rem', padding: '0.75rem',
              background: 'rgba(239,68,68,0.1)', borderRadius: 8,
              fontSize: '0.8rem', color: '#fca5a5',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{scannerError}</span>
            </div>
          )}
        </div>
      )}

      {productsQuery.isPending ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat produk...</div>
      ) : products.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada produk</div>
      ) : (
        <form id="opname-form" onSubmit={submit}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input input-sm"
                style={{ paddingLeft: '2rem', width: '100%' }}
                placeholder="Cari produk atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`btn btn-sm ${showDiffOnly ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowDiffOnly(!showDiffOnly)}
              style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Filter size={14} />
              {showDiffOnly ? 'Semua' : 'Selisih'}
            </button>
          </div>

          <div className="tbl-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>SKU</th>
                  <th>Sistem</th>
                  <th>Fisik</th>
                  <th>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Tidak ada produk ditemukan</td></tr>
                ) : (
                  filteredProducts.map((p) => {
                    const d = diff(p.id);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.sku}</td>
                        <td>{fmtQty(p.stock_current, p.unit)}</td>
                        <td>
                          <input
                            id={`opname-input-${p.id}`}
                            className="input input-sm"
                            type="number"
                            step="any"
                            style={{ width: 100 }}
                            value={actual[p.id] || ''}
                            onChange={(e) => setActual({ ...actual, [p.id]: e.target.value })}
                          />
                        </td>
                        <td style={{
                          fontWeight: 700,
                          color: d === 0 ? 'var(--text-muted)' : d > 0 ? 'var(--primary)' : 'var(--danger)',
                        }}>
                          {d === 0 ? '-' : `${d > 0 ? '+' : ''}${fmtQty(d, p.unit)}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </Modal>
  );
}
