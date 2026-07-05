import { useEffect, useState, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { fmtRp } from '../../lib/utils';
import { DownloadButton } from '../../components/DownloadButton';
import type { CashflowItem } from '../../types';

const periods = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
  { label: '60 Hari', days: 60 },
  { label: '90 Hari', days: 90 },
];

export function StockArusKas() {
  const { token } = useStockStore();
  const [data, setData] = useState<CashflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const d = await stockApi.get<CashflowItem[]>(`/api/stock/cashflow?days=${days}`, token);
      setData(d);
    } catch (e) { console.error('[StockArusKas] Load gagal', e); }
    finally { setLoading(false); }
  }, [token, days]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Arus Kas</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Pergerakan kas harian</p>
        </div>
        <Skeleton width="200px" height="2rem" />
      </div>
      <div className="grid grid-3" style={{ gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
      </div>
      <div className="card card-p" style={{ padding: '1.5rem' }}>
        <Skeleton width="180px" height="1rem" />
        <div style={{ marginTop: '1rem', display: 'flex', gap: '2px', alignItems: 'flex-end', height: 120 }}>
          {Array.from({ length: 14 }).map((_, i) => <Skeleton key={i} width="100%" height={`${30 + Math.random() * 80}px`} />)}
        </div>
      </div>
      <div className="tbl-wrap"><table><thead><tr>{['Tanggal','Pemasukan','Pengeluaran','Bersih'].map(h => <th key={h}><Skeleton width="70%" height="0.8rem" /></th>)}</tr></thead><tbody>{Array.from({ length: 5 }).map((_, r) => <tr key={r}>{Array.from({ length: 4 }).map((_, c) => <td key={c}><Skeleton width={`${60 + Math.random() * 30}%`} height="0.8rem" /></td>)}</tr>)}</tbody></table></div>
    </div>
  );

  if (data.length === 0) return <EmptyState icon="💳" title="Belum Ada Arus Kas" text="Arus kas akan muncul setelah ada transaksi pemasukan dan pengeluaran." />;

  const totalMasuk = data.reduce((s, d) => s + d.masuk, 0);
  const totalKeluar = data.reduce((s, d) => s + d.keluar, 0);
  const totalBersih = totalMasuk - totalKeluar;
  const maxVal = Math.max(...data.map(d => Math.max(d.masuk, d.keluar)), 1);

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Arus Kas</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Pergerakan kas harian
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
          <DownloadButton url={`/api/stock/export/arus-kas?days=${days}`} filename={`ArusKas-${days}d.xlsx`} />
        </div>
      </div>

      <div className="grid grid-3" style={{ gap: '1rem' }}>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(totalMasuk)}</div>
          <div className="stat-label">💰 Total Pemasukan</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmtRp(totalKeluar)}</div>
          <div className="stat-label">💸 Total Pengeluaran</div>
        </div>
        <div className="card card-p">
          <div className="stat-value" style={{ color: totalBersih >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
            {fmtRp(totalBersih)}
          </div>
          <div className="stat-label">{totalBersih >= 0 ? '✅ Kas Bersih' : '❌ Defisit'}</div>
        </div>
      </div>

      <div className="card card-p" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Grafik Arus Kas Harian</h3>
        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: 120, paddingBottom: '1.5rem', position: 'relative' }}>
          {data.map((d, i) => {
            const masukH = (d.masuk / maxVal) * 100;
            const keluarH = (d.keluar / maxVal) * 100;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.max(keluarH, 1)}%`, background: 'var(--danger)', borderRadius: '2px 2px 0 0', minHeight: 2, opacity: 0.7 }} title={`Keluar: ${fmtRp(d.keluar)}`} />
                <div style={{ width: '100%', height: `${Math.max(masukH, 1)}%`, background: 'var(--primary)', borderRadius: '2px 2px 0 0', minHeight: 2, opacity: 0.7 }} title={`Masuk: ${fmtRp(d.masuk)}`} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th style={{ textAlign: 'right' }}>Pemasukan</th>
              <th style={{ textAlign: 'right' }}>Pengeluaran</th>
              <th style={{ textAlign: 'right' }}>Bersih</th>
            </tr>
          </thead>
          <tbody>
            {data.slice().reverse().map((d, i) => {
              const bersih = d.masuk - d.keluar;
              return (
                <tr key={i}>
                  <td>{new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{d.masuk > 0 ? fmtRp(d.masuk) : '-'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>{d.keluar > 0 ? fmtRp(d.keluar) : '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: bersih >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
                    {fmtRp(bersih)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
