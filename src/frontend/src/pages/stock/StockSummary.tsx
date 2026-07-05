import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtQty } from '../../lib/utils';
import { BarChart3, AlertTriangle, Package } from 'lucide-react';
import type { StockSummaryData } from '../../types';

export function StockSummary() {
  const { token } = useStockStore();
  const [data, setData] = useState<StockSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    stockApi.get<StockSummaryData>('/api/stock/summary', token)
      .then(setData)
      .catch((err) => console.error('[StockSummary] Fetch gagal', err))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Ringkasan Stok</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Overview stok dan nilai inventori</p>
      </div>
      <div className="grid grid-4" style={{ gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
      </div>
    </div>
  );

  if (!data) return <EmptyState icon="📊" title="Tidak Ada Data" text="Belum ada data stok." />;

  const sortedCategories = Object.entries(data.byCategory).sort((a, b) => b[1].value - a[1].value);
  const maxValue = sortedCategories.length > 0 ? sortedCategories[0][1].value : 0;

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <BarChart3 size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Ringkasan Stok
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Overview stok dan nilai inventori
        </p>
      </div>

      <div className="grid grid-4" style={{ gap: '1rem' }}>
        <div className="card card-p">
          <div className="stat-value">{data.total}</div>
          <div className="stat-label">Total Produk</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(data.totalValue)}</div>
          <div className="stat-label">Nilai Inventori</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: data.lowStock > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
            {data.lowStock}
          </div>
          <div className="stat-label">Stok Menipis</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: data.outStock > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {data.outStock}
          </div>
          <div className="stat-label">Stok Habis</div>
        </div>
      </div>

      {/* Category breakdown with bar chart */}
      {sortedCategories.length > 0 && (
        <div className="card card-p">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <Package size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
            Inventori per Kategori
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sortedCategories.map(([cat, info]) => (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 600 }}>{cat}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {info.count} produk · {fmtRp(info.value)}
                  </span>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: maxValue > 0 ? `${(info.value / maxValue) * 100}%` : '0%',
                    height: '100%',
                    background: 'var(--primary)',
                    borderRadius: 6,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="card card-p" style={{ borderLeft: '3px solid var(--warning)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <AlertTriangle size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
            Peringatan Stok ({data.alerts.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.alerts.map(a => (
              <div key={a.id} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {a.products?.name || `Produk #${a.product_id}`}
                  {a.alert_type === 'out_of_stock' ? ' — Stok Habis' : ' — Stok Menipis'}
                </span>
                <span>
                  <Badge variant={a.alert_type === 'out_of_stock' ? 'habis' : 'menipis'}>
                    {a.alert_type === 'out_of_stock'
                      ? 'Habis'
                      : `${fmtQty(a.stock_level, a.products?.unit)} tersisa`}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.alerts.length === 0 && (
        <div className="card card-p" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <AlertTriangle size={24} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
          <div>Tidak ada peringatan stok. Semua produk dalam kondisi aman.</div>
        </div>
      )}
    </div>
  );
}
