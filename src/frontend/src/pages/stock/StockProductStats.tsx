import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtQty } from '../../lib/utils';
import { BarChart3, TrendingUp, ArrowUpDown, ShoppingCart, DollarSign, Package } from 'lucide-react';
import type { ProductStatsData, SalesReportData } from '../../types';

type SortKey = 'name' | 'profitPerUnit' | 'margin' | 'stockValue';
type SortKeyReal = 'name' | 'qty' | 'revenue' | 'hpp' | 'profit' | 'avgMargin';

export function StockProductStats() {
  const { token } = useStockStore();
  const [tab, setTab] = useState<'teoritis' | 'riil'>('riil');
  const [sortKey, setSortKey] = useState<SortKey>('margin');
  const [sortAsc, setSortAsc] = useState(false);
  const [sortKeyR, setSortKeyR] = useState<SortKeyReal>('revenue');
  const [sortAscR, setSortAscR] = useState(false);
  const [days, setDays] = useState(30);

  const query = useQuery({
    queryKey: ['product-stats', token],
    queryFn: () => stockApi.get<ProductStatsData>('/api/stock/product-stats', token!),
    enabled: !!token,
  });

  const salesQuery = useQuery({
    queryKey: ['product-sales', token, days],
    queryFn: () => stockApi.get<SalesReportData>(`/api/stock/product-sales?days=${days}`, token!),
    enabled: !!token,
  });

  const data = query.data ?? null;
  const salesData = salesQuery.data ?? null;
  const loading = query.isPending;
  const salesLoading = salesQuery.isPending;

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.products].sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });
  }, [data, sortKey, sortAsc]);

  const sortedReal = useMemo(() => {
    if (!salesData) return [];
    return [...salesData.products].sort((a, b) => {
      const mul = sortAscR ? 1 : -1;
      if (sortKeyR === 'name') return mul * a.name.localeCompare(b.name);
      return mul * ((a[sortKeyR] as number) - (b[sortKeyR] as number));
    });
  }, [salesData, sortKeyR, sortAscR]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const toggleSortReal = (key: SortKeyReal) => {
    if (sortKeyR === key) setSortAscR(v => !v);
    else { setSortKeyR(key); setSortAscR(false); }
  };

  const sortIcon = (key: string) => {
    return <ArrowUpDown size={12} style={{ marginLeft: 2, opacity: 0.5 }} />;
  };

  const avgMargin = data?.products.length
    ? Math.round(data.products.reduce((s, p) => s + p.margin, 0) / data.products.length)
    : 0;

  const totalStockValue = data?.products.reduce((s, p) => s + p.stockValue, 0) || 0;

  if (loading && tab === 'teoritis') return (
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

  if (salesLoading && tab === 'riil') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <BarChart3 size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Analisa Produk
        </h2>
      </div>
      <div className="grid grid-4" style={{ gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card card-p" style={{ height: 80 }} />)}
      </div>
      <TableSkeleton rows={8} cols={7} />
    </div>
  );

  if (!data && !salesData) return (
    <EmptyState icon="📈" title="Belum Ada Data" text="Belum ada produk untuk dianalisa." />
  );

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <BarChart3 size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Analisa Produk
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${tab === 'riil' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('riil')}
        >
          <ShoppingCart size={14} /> Riil
        </button>
        <button
          className={`btn btn-sm ${tab === 'teoritis' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('teoritis')}
        >
          <TrendingUp size={14} /> Teoritis
        </button>
      </div>

      {tab === 'teoritis' && data && data.products.length > 0 && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Profitabilitas teoritis (price_sell - price_buy), margin, dan nilai inventori per produk
          </p>

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
                    Produk {sortKey === 'name' ? sortIcon('name') : null}
                  </th>
                  <th>Kategori</th>
                  <th style={{ textAlign: 'right' }}>Harga Beli</th>
                  <th style={{ textAlign: 'right' }}>Harga Jual</th>
                  <th onClick={() => toggleSort('profitPerUnit')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    Laba/Unit {sortKey === 'profitPerUnit' ? sortIcon('profitPerUnit') : null}
                  </th>
                  <th onClick={() => toggleSort('margin')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    Margin {sortKey === 'margin' ? sortIcon('margin') : null}
                  </th>
                  <th>Stok</th>
                  <th onClick={() => toggleSort('stockValue')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    Nilai Stok {sortKey === 'stockValue' ? sortIcon('stockValue') : null}
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
        </>
      )}

      {tab === 'teoritis' && data && data.products.length === 0 && (
        <EmptyState icon="📈" title="Belum Ada Data" text="Belum ada produk untuk dianalisa." />
      )}

      {tab === 'riil' && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Data penjualan riil berdasarkan transaksi kasir dan stok keluar
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[7, 30, 90, 365].map(d => (
              <button
                key={d}
                className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDays(d)}
              >
                {d === 365 ? '1 Thn' : `${d}H`}
              </button>
            ))}
          </div>

          {salesData && salesData.products.length > 0 ? (
            <>
              <div className="grid grid-4" style={{ gap: '1rem' }}>
                <div className="card card-p">
                  <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(salesData.summary.totalRevenue)}</div>
                  <div className="stat-label">Total Revenue</div>
                </div>
                <div className="card card-p">
                  <div className="stat-value" style={{ color: salesData.summary.totalProfit >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
                    {fmtRp(salesData.summary.totalProfit)}
                  </div>
                  <div className="stat-label">Total Laba</div>
                </div>
                <div className="card card-p">
                  <div className="stat-value">{fmtQty(salesData.summary.totalQty, 'pcs')}</div>
                  <div className="stat-label">Total Terjual</div>
                </div>
                <div className="card card-p">
                  <div className="stat-value" style={{ color: salesData.summary.totalRevenue > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {salesData.summary.totalRevenue > 0
                      ? `${Math.round((salesData.summary.totalProfit / salesData.summary.totalRevenue) * 100)}%`
                      : '-'}
                  </div>
                  <div className="stat-label">Rata-rata Margin</div>
                </div>
              </div>

              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => toggleSortReal('name')} style={{ cursor: 'pointer' }}>
                        Produk {sortKeyR === 'name' ? sortIcon('name') : null}
                      </th>
                      <th>Kategori</th>
                      <th onClick={() => toggleSortReal('qty')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        Terjual {sortKeyR === 'qty' ? sortIcon('qty') : null}
                      </th>
                      <th onClick={() => toggleSortReal('revenue')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        Revenue {sortKeyR === 'revenue' ? sortIcon('revenue') : null}
                      </th>
                      <th onClick={() => toggleSortReal('hpp')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        HPP {sortKeyR === 'hpp' ? sortIcon('hpp') : null}
                      </th>
                      <th onClick={() => toggleSortReal('profit')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        Laba {sortKeyR === 'profit' ? sortIcon('profit') : null}
                      </th>
                      <th onClick={() => toggleSortReal('avgMargin')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                        Margin Riil {sortKeyR === 'avgMargin' ? sortIcon('avgMargin') : null}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReal.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td><span className="badge badge-gray">{p.category}</span></td>
                        <td style={{ textAlign: 'right' }}>{fmtQty(p.qty, p.unit)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtRp(p.revenue)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtRp(p.hpp)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: p.profit >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
                          {fmtRp(p.profit)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Badge variant={p.avgMargin >= 30 ? 'active' : p.avgMargin >= 15 ? 'menipis' : 'habis'}>
                            {p.avgMargin}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {salesData.byCategory.length > 0 && (
                <div className="card card-p">
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Package size={18} /> Penjualan per Kategori
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {salesData.byCategory.map(cat => {
                      const maxRev = Math.max(...salesData.byCategory.map(c => c.revenue), 1);
                      const barPct = Math.round((cat.revenue / maxRev) * 100);
                      const marginPct = cat.revenue > 0 ? Math.round((cat.profit / cat.revenue) * 100) : 0;
                      return (
                        <div key={cat.category}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>{cat.category}</span>
                            <span>{fmtQty(cat.qty, 'pcs')} · {fmtRp(cat.revenue)}</span>
                          </div>
                          <div className="progress">
                            <div className="progress-fill" style={{ width: `${barPct}%`, background: marginPct >= 30 ? 'var(--primary)' : marginPct >= 15 ? 'var(--warning)' : 'var(--danger)' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            <span>Laba: {fmtRp(cat.profit)}</span>
                            <span>Margin: {marginPct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon="🛒" title="Belum Ada Penjualan" text="Belum ada transaksi penjualan dalam periode ini." />
          )}
        </>
      )}

      {tab === 'teoritis' && (
        <div className="card card-p" style={{ background: 'var(--bg)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <TrendingUp size={14} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
          Klik header kolom untuk mengurutkan. Margin &ge; 30% dianggap sehat, 15-30% cukup, &lt; 15% rendah.
        </div>
      )}
    </div>
  );
}
