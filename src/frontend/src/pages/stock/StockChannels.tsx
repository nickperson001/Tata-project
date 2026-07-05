import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { InfoTip } from '../../components/InfoTip';
import { toast } from '../../components/Toast';
import { fmtRp } from '../../lib/utils';
import { GitBranch, TrendingUp } from 'lucide-react';
import type { ChannelsData } from '../../types';

const presets = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
  { label: '1 Tahun', days: 365 },
];

const channelColors = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

export function StockChannels() {
  const { token } = useStockStore();
  const [data, setData] = useState<ChannelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    stockApi.get<ChannelsData>(`/api/stock/channels?days=${days}`, token)
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : '[StockChannels] Fetch gagal'))
      .finally(() => setLoading(false));
  }, [token, days]);

  const total = data ? Object.values(data).reduce((s, v) => s + v, 0) : 0;
  const entries = data ? Object.entries(data).sort((a, b) => b[1] - a[1]) : [];

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Penjualan per Channel</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Revenue breakdown berdasarkan channel penjualan</p>
      </div>
      <div className="grid grid-3" style={{ gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
      </div>
    </div>
  );

  if (!data || entries.length === 0)
    return <EmptyState icon="🛒" title="Belum Ada Data" text="Belum ada transaksi penjualan." />;

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            <GitBranch size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Penjualan per Channel
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Revenue breakdown berdasarkan channel penjualan
            <InfoTip text="Data dihitung dari transaksi penjualan yang tercatat dengan channel. Admin fee sudah diperhitungkan." />
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {presets.map(p => (
            <button
              key={p.days}
              className={`btn btn-sm ${days === p.days ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-3" style={{ gap: '1rem' }}>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(total)}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="card card-p">
          <div className="stat-value">{entries.length}</div>
          <div className="stat-label">Channel Aktif</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {entries[0][0]}
          </div>
          <div className="stat-label">Channel Teratas</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="card card-p">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          <TrendingUp size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
          Distribusi Revenue
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(([channel, amount], i) => {
            const pct = total > 0 ? (amount / total) * 100 : 0;
            const color = channelColors[i % channelColors.length];
            return (
              <div key={channel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: '0.4rem' }} />
                    {channel}
                  </span>
                  <span style={{ fontWeight: 700 }}>{fmtRp(amount)}</span>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 6,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  {pct.toFixed(1)}% dari total
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
              <th style={{ textAlign: 'right' }}>Kontribusi</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([channel, amount], i) => {
              const pct = total > 0 ? (amount / total) * 100 : 0;
              return (
                <tr key={channel}>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: channelColors[i % channelColors.length], marginRight: '0.5rem' }} />
                    {channel}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtRp(amount)}</td>
                  <td style={{ textAlign: 'right' }}>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--text)', fontWeight: 800 }}>
              <td>Total</td>
              <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmtRp(total)}</td>
              <td style={{ textAlign: 'right' }}>100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
