import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtQty } from '../../lib/utils';
import { TrendingUp, Package } from 'lucide-react';

interface ReportData {
  totalIn: number;
  totalOut: number;
  totalAdj: number;
  count: number;
  topOut: Array<{ name: string; sku: string; total: number; pct: number; unit: string }>;
  byCategory: Record<string, { count: number; value: number }>;
  total: number;
}

export function StockReport() {
  const { token } = useStockStore();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    stockApi.get<ReportData>(`/api/stock/report?days=${days}`, token)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, days]);

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Laporan Evaluasi</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Analisa pergerakan stok</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Periode:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDays(d)}
          >
            {d} hari
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <div className="grid grid-4" style={{ gap: '1rem' }}>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
          </div>
          <div className="card card-p"><Skeleton width="200px" height="1rem" />{Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ marginTop: '0.75rem' }}><Skeleton width="100%" height="0.8rem" /><Skeleton width="80%" height="0.4rem" style={{ marginTop: 4 }} /></div>)}</div>
        </>
      ) : !data ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada data
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ gap: '1rem' }}>
            <div className="card card-p">
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(data.totalIn)}</div>
              <div className="stat-label">Stok Masuk</div>
            </div>
            <div className="card card-p">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmtRp(data.totalOut)}</div>
              <div className="stat-label">Stok Keluar</div>
            </div>
            <div className="card card-p">
              <div className="stat-value">{data.totalAdj}</div>
              <div className="stat-label">Penyesuaian</div>
            </div>
            <div className="card card-p">
              <div className="stat-value">{data.total}</div>
              <div className="stat-label">Total Transaksi</div>
            </div>
          </div>

          {data.topOut.length > 0 && (
            <div className="card card-p">
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} /> Produk Terlaris
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.topOut.map((p, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span>{fmtQty(p.total, p.unit)}</span>
                    </div>
                    <div className="progress">
                      <div className="progress-fill" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.byCategory && Object.keys(data.byCategory).length > 0 && (
            <div className="card card-p">
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} /> Kategori
              </h3>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kategori</th>
                      <th>Jumlah</th>
                      <th>Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byCategory).map(([cat, info]) => (
                      <tr key={cat}>
                        <td><Badge>{cat}</Badge></td>
                        <td>{info.count}</td>
                        <td style={{ fontWeight: 600 }}>{fmtRp(info.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
