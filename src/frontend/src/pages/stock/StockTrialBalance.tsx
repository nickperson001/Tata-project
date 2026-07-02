import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { InfoTip } from '../../components/InfoTip';
import { fmtRp } from '../../lib/utils';
import type { TrialBalanceData } from '../../types';

const typeColors: Record<string, string> = {
  asset: 'badge-purple',
  liability: 'badge-amber',
  equity: 'badge-blue',
  revenue: 'badge-green',
  cogs: 'badge-red',
  expense: 'badge-red',
};

const typeLabels: Record<string, string> = {
  asset: 'Aset', liability: 'Liabilitas', equity: 'Ekuitas',
  revenue: 'Pendapatan', cogs: 'HPP', expense: 'Beban',
};

export function StockTrialBalance() {
  const { token } = useStockStore();
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const d = await stockApi.get<TrialBalanceData>('/api/stock/trial-balance', token);
        setData(d);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Neraca Saldo</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Daftar saldo seluruh akun — digunakan untuk memverifikasi keseimbangan debit dan kredit</p>
      </div>
      <div className="tbl-wrap"><table><thead><tr>{['Kode','Nama Akun','Tipe','Debit','Kredit'].map(h => <th key={h}><Skeleton width="70%" height="0.8rem" /></th>)}</tr></thead><tbody>{Array.from({ length: 8 }).map((_, r) => <tr key={r}>{Array.from({ length: 5 }).map((_, c) => <td key={c}><Skeleton width={`${50 + Math.random() * 40}%`} height="0.8rem" /></td>)}</tr>)}</tbody></table></div>
    </div>
  );

  if (!data || data.rows.length === 0) return <EmptyState icon="📋" title="Belum Ada Data" text="Neraca saldo akan tersedia setelah ada jurnal yang tercatat." />;

  const totalDebit = data.rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = data.rows.reduce((s, r) => s + r.credit, 0);
  const balance = Math.abs(totalDebit - totalCredit) < 1;

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Neraca Saldo</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Daftar saldo seluruh akun — digunakan untuk memverifikasi keseimbangan debit dan kredit
            <InfoTip text="Neraca saldo adalah daftar seluruh akun beserta saldonya. Total Debit harus sama dengan Total Kredit." />
          </p>
        </div>
        <div className={`neraca-check ${balance ? 'ok' : 'ko'}`}>
          {balance ? '✅ Balance' : '⚠️ Tidak Balance'}
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Akun</th>
              <th>Tipe</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Kredit</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.code}</td>
                <td style={{ fontWeight: 500 }}>{row.name}</td>
                <td><span className={`badge ${typeColors[row.type] || 'badge-gray'}`}>{typeLabels[row.type] || row.type}</span></td>
                <td style={{ textAlign: 'right', color: row.debit > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                  {row.debit > 0 ? fmtRp(row.debit) : '-'}
                </td>
                <td style={{ textAlign: 'right', color: row.credit > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                  {row.credit > 0 ? fmtRp(row.credit) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--text)', fontWeight: 800 }}>
              <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.9rem' }}>Total</td>
              <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmtRp(totalDebit)}</td>
              <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmtRp(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
