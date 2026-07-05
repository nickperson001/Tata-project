import { useEffect, useMemo, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtQty } from '../../lib/utils';
import { BarChart3, TrendingUp, ArrowUpDown } from 'lucide-react';
import type { ProductStatsData, ProductStatItem } from '../../types';

type SortKey = 'name' | 'profitPerUnit' | 'margin' | 'stockValue';

export function StockProductStats() {
  const { token } = useStockStore();
  const [data, setData] = useState<ProductStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('margin');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!token) return;
    stockApi.get<ProductStatsData>('/api/stock/product-stats', token)
      .then(setData)
      .catch((err) => console.error('[StockProductStats] Fetch gagal', err))
      .finally(() => setLoading(false));
  }, [token]);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.products].sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <ArrowUpDown size={12} style={{ marginLeft: 2, opacity: 0.5 }} />;
  };

  const avgMargin = data?.products.length
    ? Math.round(data.products.reduce((s, p) => s + p.margin, 0) / data.products.length)
    : 0;

  const totalStockValue = data?.products.reduce((s, p) => s + p.stockValue, 0) || 0;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Analisa Produk</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Profitabilitas dan margin per produk</p>
      </div>
      <div className="grid grid-3" style={{ gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-p" style={{ height: 80 }} />)}
      </div>
      <TableSkeleton rows={8} cols={7} />
    </div>
  );

  if (!data || data.products.length === 0)
    return <EmptyState icon="📈" title="Belum Ada Data" text="Belum ada produk untuk dianalisa." />;

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <BarChart3 size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Analisa Produk
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Profitabilitas, margin, dan nilai inventori per produk
        </p>
      </div>

      <div className="grid grid-3" style={{ gap: '1rem' }}>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(totalStockValue)}</div>
          <div className="stat-label">Total Nilai Inventori</div>
        </div>
        <div className="card card-p">
          <div className="stat-value">{data.products.length}</div>
          <div className="stat-label">Total Produk</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: avgMargin >= 30 ? 'var(--primary)' : 'var(--warning)' }}>
            {avgMargin}%
          </div>
          <div className="stat-label">Rata-rata Margin</div>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                Produk {sortIcon('name')}
              </th>
              <th>Kategori</th>
              <th style={{ textAlign: 'right' }}>Harga Beli</th>
              <th style={{ textAlign: 'right' }}>Harga Jual</th>
              <th onClick={() => toggleSort('profitPerUnit')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Laba/Unit {sortIcon('profitPerUnit')}
              </th>
              <th onClick={() => toggleSort('margin')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Margin {sortIcon('margin')}
              </th>
              <th>Stok</th>
              <th onClick={() => toggleSort('stockValue')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                Nilai Stok {sortIcon('stockValue')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td><span className="badge badge-gray">{p.category || '-'}</span></td>
                <td style={{ textAlign: 'right' }}>{fmtRp(p.price_buy)}</td>
                <td style={{ textAlign: 'right' }}>{fmtRp(p.price_sell)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                  {fmtRp(p.profitPerUnit)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Badge variant={p.margin >= 30 ? 'active' : p.margin >= 15 ? 'menipis' : 'habis'}>
                    {`${p.margin}%`}
                  </Badge>
                </td>
                <td>
                  <Badge variant={p.stock_current <= 0 ? 'habis' : p.stock_current <= p.stock_min ? 'menipis' : 'aman'}>
                    {fmtQty(p.stock_current, p.unit)}
                  </Badge>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtRp(p.stockValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-p" style={{ background: 'var(--bg)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <TrendingUp size={14} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
        Klik header kolom untuk mengurutkan. Margin &ge; 30% dianggap sehat, 15-30% cukup, &lt; 15% rendah.
      </div>
    </div>
  );
}
