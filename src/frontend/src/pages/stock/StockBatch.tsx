import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtQty, fmtDateTime } from '../../lib/utils';
import { Database, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import type { BatchData, BatchProduct, BatchMovement } from '../../types';

export function StockBatch() {
  const { token } = useStockStore();
  const [data, setData] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    stockApi.get<BatchData>('/api/stock/batch', token)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Data Lengkap</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ringkasan stok, produk, dan pergerakan terbaru</p>
      </div>
      <div className="grid grid-4" style={{ gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card card-p"><TableSkeleton rows={0} cols={0} /></div>)}
      </div>
      <TableSkeleton rows={6} cols={6} />
      <TableSkeleton rows={4} cols={5} />
    </div>
  );

  if (!data) return <EmptyState icon="📦" title="Tidak Ada Data" text="Belum ada data produk atau stok." />;

  const { products, summary, recentMovements } = data;

  const stockStatus = (p: BatchProduct) => {
    if (p.stock_current <= 0) return { label: 'Habis', variant: 'habis' };
    if (p.stock_current <= p.stock_min) return { label: 'Menipis', variant: 'menipis' };
    return { label: `${p.stock_current} ${p.unit}`, variant: 'aman' };
  };

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <Database size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Data Lengkap
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Ringkasan stok, daftar produk, dan pergerakan terbaru
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-4" style={{ gap: '1rem' }}>
        <div className="card card-p">
          <div className="stat-value">{summary.total}</div>
          <div className="stat-label">Total Produk</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(summary.totalValue)}</div>
          <div className="stat-label">Nilai Inventori</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: summary.lowStock > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
            {summary.lowStock}
          </div>
          <div className="stat-label">Stok Menipis</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: summary.outStock > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {summary.outStock}
          </div>
          <div className="stat-label">Stok Habis</div>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(summary.byCategory).length > 0 && (
        <div className="card card-p">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <Package size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
            Per Kategori
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {Object.entries(summary.byCategory).map(([cat, info]) => (
              <div key={cat} className="card" style={{ padding: '0.5rem 1rem', flex: '1 0 140px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cat}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {info.count} produk · {fmtRp(info.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {summary.alerts.length > 0 && (
        <div className="card card-p" style={{ borderLeft: '3px solid var(--warning)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <AlertTriangle size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
            Peringatan Stok
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {summary.alerts.map(a => (
              <div key={a.id} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {a.products?.name || `Produk #${a.product_id}`}
                  {a.alert_type === 'out_of_stock' ? ' — Habis' : ' — Menipis'}
                </span>
                <Badge variant={a.alert_type === 'out_of_stock' ? 'habis' : 'menipis'}>
                  {a.alert_type === 'out_of_stock' ? 'Habis' : `${a.stock_level} tersisa`}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products table */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Daftar Produk ({products.length})</h3>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>SKU</th>
                <th>Kategori</th>
                <th>Harga Beli</th>
                <th>Harga Jual</th>
                <th>Stok</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const ss = stockStatus(p);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.sku}</td>
                    <td>{p.category || '-'}</td>
                    <td>{fmtRp(p.price_buy)}</td>
                    <td>{fmtRp(p.price_sell)}</td>
                    <td>{fmtQty(p.stock_current, p.unit)}</td>
                    <td><Badge variant={ss.variant}>{ss.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent movements */}
      {recentMovements.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <TrendingUp size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
            Pergerakan Terbaru
          </h3>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Tipe</th>
                  <th>Qty</th>
                  <th>Stok Akhir</th>
                  <th>Waktu</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.products?.name || `#${m.product_id}`}</td>
                    <td>
                      <Badge variant={m.type === 'in' ? 'active' : 'habis'}>
                        {m.type === 'in' ? 'Masuk' : 'Keluar'}
                      </Badge>
                    </td>
                    <td>{m.quantity}</td>
                    <td>{m.stock_after}</td>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDateTime(m.created_at)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{m.note || '-'}</td>
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
