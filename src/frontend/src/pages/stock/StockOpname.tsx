import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { toast } from '../../components/Toast';
import { Skeleton, TableSkeleton } from '../../components/LoadingSkeleton';
import { fmtQty } from '../../lib/utils';
import type { Product } from '../../types';
import { ClipboardCheck, Save, Camera, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export function StockOpname() {
  const { token } = useStockStore();
  const [actual, setActual] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const productsQuery = useQuery({
    queryKey: ['opname-products', token],
    queryFn: () => stockApi.get<{ products: Product[] }>('/api/stock/products?limit=500', token!),
    enabled: !!token,
    staleTime: 30_000,
    gcTime: 60_000,
    select: (data) => {
      const list = data.products ?? data ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  const products = productsQuery.data ?? [];
  const loading = productsQuery.isPending;
  const error = productsQuery.isError;

  useEffect(() => {
    if (!productsQuery.data) return;
    const init: Record<string, string> = {};
    products.forEach((p: Product) => { init[p.id] = p.stock_current.toString(); });
    setActual(init);
  }, [products, productsQuery.data]);

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
    if (!showScanner) {
      setScannerError('');
      return;
    }
    setScannerError('');
    const scanner = new Html5QrcodeScanner(
      'reader',
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
          const el = document.getElementById(`input-${product.id}`);
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
    return () => { scanner.clear().catch((err) => console.error('[StockOpname] Scanner clear gagal', err)); };
  }, [showScanner, products]);

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
      toast(`${count} produk diupdate`);
    } finally {
      setSaving(false);
    }
  }

  function diff(id: string): number {
    const p = products.find((x) => x.id === id);
    if (!p) return 0;
    return (parseFloat(actual[id]) || 0) - p.stock_current;
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Opname Stok</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cocokkan stok sistem dengan stok fisik via scan barcode atau manual</p>
        </div>
        <Skeleton width="130px" height="2rem" />
      </div>
      <TableSkeleton rows={8} cols={5} />
    </div>
  );

  if (error) return (
    <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', borderColor: 'var(--danger)', borderWidth: 2 }}>
      <AlertCircle size={36} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Gagal Memuat Data</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 1rem' }}>
        Server penyimpanan data sedang tidak dapat dijangkau. Silakan coba lagi.
      </p>
      <button className="btn btn-primary btn-sm" onClick={() => productsQuery.refetch()}>
        <RefreshCw size={14} /> Coba Lagi
      </button>
    </div>
  );

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Opname Stok</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cocokkan stok sistem dengan stok fisik via scan barcode atau manual</p>
        </div>
        <button className={`btn ${showScanner ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setShowScanner(!showScanner)}>
          {showScanner ? <X size={16} /> : <Camera size={16} />}
          {showScanner ? 'Tutup Scanner' : 'Scan Barcode'}
        </button>
      </div>

      {showScanner && (
        <div className="card card-p" style={{ maxWidth: 400, margin: '0 auto' }}>
          <div id="reader"></div>
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

      <form onSubmit={submit}>
        <div className="tbl-wrap">
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
              {products.map((p) => {
                const d = diff(p.id);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.sku}</td>
                    <td>{fmtQty(p.stock_current, p.unit)}</td>
                    <td>
                      <input
                        id={`input-${p.id}`}
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
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            <Save size={16} />
            {saving ? 'Menyimpan...' : 'Simpan Opname'}
          </button>
        </div>
      </form>
    </div>
  );
}
