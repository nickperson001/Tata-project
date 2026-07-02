import { useEffect, useState, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { InfoTip } from '../../components/InfoTip';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar, type DateRange } from '../../components/FilterBar';
import { fmtRp } from '../../lib/utils';
import type { LabaRugiData } from '../../types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { DownloadButton } from '../../components/DownloadButton';

const periods = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
  { label: '1 Tahun', days: 365 },
];

export function StockLabaRugi() {
  const { token, user } = useStockStore();
  const [data, setData] = useState<LabaRugiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [filterChannel, setFilterChannel] = useState('');
  const [activeChannels, setActiveChannels] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (filterChannel) params.set('channel', filterChannel);
      const [d, settings] = await Promise.all([
        stockApi.get<LabaRugiData>(`/api/stock/laba-rugi?${params}`, token),
        stockApi.get<{ settings: any }>('/api/stock/settings', token),
      ]);
      setData(d);
      if (settings.settings?.active_channels) setActiveChannels(settings.settings.active_channels);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token, days, filterChannel]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <FilterBar
        showChannel
        channel={filterChannel}
        onChannelChange={setFilterChannel}
        channels={activeChannels}
        showSearch={false}
        showDateFilter={false}
        showStatus={false}
        showCategory={false}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Laba Rugi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Laporan pendapatan dan beban selama periode tertentu</p>
        </div>
        <Skeleton width="200px" height="2rem" />
      </div>
      <div className="grid grid-4" style={{ gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
      </div>
      <div className="card card-p" style={{ padding: '1.5rem' }}>
        <Skeleton width="150px" height="1rem" />
        {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ marginTop: '1rem' }}><Skeleton width="100%" height="0.8rem" /><div className="sr" style={{ paddingLeft: '1.5rem' }}><Skeleton width="60%" height="0.8rem" /><Skeleton width="80px" height="0.8rem" /></div></div>)}
      </div>
    </div>
  );

  if (!data) return <EmptyState icon="📊" title="Belum Ada Data Laba Rugi" text="Catat transaksi pembukuan terlebih dahulu untuk melihat laporan laba rugi." />;

  if (user?.status === 'demo') {
    return (
      <div className="card card-p" style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: 480, margin: '2rem auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Fitur Laba Rugi</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Fitur ini hanya tersedia untuk pengguna PRO.
        </p>
        <a
          href="https://wa.me/6283121376756?text=Halo%20saya%20ingin%20upgrade%20Tata%20Business%20Suite%20ke%20PRO"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          Upgrade ke PRO
        </a>
      </div>
    );
  }

  const isProfit = data.labaBersih >= 0;
  const sections = [
    { label: 'Pendapatan', rows: data.rows.filter(r => r.account_type === 'revenue'), total: data.totalRevenue, color: 'var(--primary)' },
    { label: 'Harga Pokok Penjualan (HPP)', rows: data.rows.filter(r => r.account_type === 'cogs'), total: data.totalCOGS, color: 'var(--danger)' },
    { label: 'Beban Operasional', rows: data.rows.filter(r => r.account_type === 'expense'), total: data.totalExpense, color: 'var(--danger)' },
  ];

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Filter Bar */}
      <FilterBar
        showChannel
        channel={filterChannel}
        onChannelChange={setFilterChannel}
        channels={activeChannels}
        showSearch={false}
        showDateFilter={false}
        showStatus={false}
        showCategory={false}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Laba Rugi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Laporan pendapatan dan beban selama periode tertentu
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="period-bar">
            {periods.map(p => (
              <button key={p.days} className={`period-btn${days === p.days ? ' active' : ''}`} onClick={() => setDays(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
          <DownloadButton url={`/api/stock/export/laba-rugi?days=${days}&channel=${filterChannel}`} filename={`LabaRugi-${days}d.xlsx`} />
        </div>
      </div>

      <div className="grid grid-4" style={{ gap: '1rem' }}>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(data.totalRevenue)}</div>
          <div className="stat-label">Total Pendapatan <InfoTip text="Seluruh pemasukan dari penjualan sebelum dikurangi biaya apapun" /></div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmtRp(data.totalCOGS + data.totalExpense)}</div>
          <div className="stat-label">Total Biaya <InfoTip text="Total HPP (modal barang) + seluruh beban operasional" /></div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--secondary)' }}>{fmtRp(data.labaKotor)}</div>
          <div className="stat-label">Laba Kotor <InfoTip text="Pendapatan dikurangi HPP (modal barang yang terjual)" /></div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: isProfit ? 'var(--primary)' : 'var(--danger)' }}>
            {fmtRp(data.labaBersih)}
          </div>
          <div className="stat-label">Laba Bersih <InfoTip text="Pendapatan dikurangi seluruh biaya (HPP + beban). Positif = laba, negatif = rugi." /></div>
        </div>
      </div>

      <div className="card card-p" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Rincian</h3>
        {sections.map(section => section.rows.length > 0 && (
          <div key={section.label} style={{ marginBottom: '1.25rem' }}>
            <div className="sr" style={{ borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
              <span className="lbl" style={{ fontWeight: 700 }}>{section.label}</span>
              <span className="val" style={{ color: section.color }}>{fmtRp(section.total)}</span>
            </div>
            {section.rows.map(row => (
              <div key={row.account_code} className="sr" style={{ paddingLeft: '1.5rem' }}>
                <span className="lbl">{row.account_name}</span>
                <span className="val" style={{ color: section.color }}>{fmtRp(row.total)}</span>
              </div>
            ))}
          </div>
        ))}

        <div className="sr sr-total" style={{ borderTop: '2px solid', borderTopColor: isProfit ? 'var(--primary)' : 'var(--danger)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
          <span className="lbl">
            {isProfit ? <><TrendingUp size={18} style={{ color: 'var(--primary)' }} /> Laba Bersih</> : <><TrendingDown size={18} style={{ color: 'var(--danger)' }} /> Laba Bersih</>}
          </span>
          <span className={`val ${isProfit ? 'sr-profit' : 'sr-loss'}`}>{fmtRp(Math.abs(data.labaBersih))}</span>
        </div>
      </div>
    </div>
  );
}
