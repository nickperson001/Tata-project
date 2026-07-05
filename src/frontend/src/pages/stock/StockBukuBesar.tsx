import { useEffect, useState, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { InfoTip } from '../../components/InfoTip';
import { fmtRp } from '../../lib/utils';
import { toast } from '../../components/Toast';
import type { GeneralLedgerData } from '../../types';

const periods = [
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
  { label: '1 Tahun', days: 365 },
];

export function StockBukuBesar() {
  const { token } = useStockStore();
  const [data, setData] = useState<GeneralLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [accounts, setAccounts] = useState<{ code: string; name: string; type: string }[]>([]);
  const [selectedCode, setSelectedCode] = useState('');

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await stockApi.get<{ accounts: { code: string; name: string; type: string }[] }>('/api/stock/coa', token);
      setAccounts(res.accounts ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : '[StockBukuBesar] Load accounts gagal'); }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setData(null);
    try {
      const q = `/api/stock/general-ledger?days=${days}${selectedCode ? `&account_code=${selectedCode}` : ''}`;
      const d = await stockApi.get<GeneralLedgerData>(q, token);
      setData(d);
    } catch (e) { toast.error(e instanceof Error ? e.message : '[StockBukuBesar] Load gagal'); }
    finally { setLoading(false); }
  }, [token, days, selectedCode]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { load(); }, [load]);

  if (loading && !data) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Buku Besar</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Rincian mutasi setiap akun</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Skeleton width="200px" height="2rem" />
          <Skeleton width="160px" height="2rem" />
        </div>
      </div>
      <div className="card card-p"><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><Skeleton width="180px" height="1.2rem" /><Skeleton width="120px" height="0.8rem" style={{ marginTop: 4 }} /></div><Skeleton width="120px" height="1.4rem" /></div></div>
      <div className="tbl-wrap"><table><thead><tr>{['Tanggal','Tipe','Deskripsi','Debit','Kredit'].map(h => <th key={h}><Skeleton width="70%" height="0.8rem" /></th>)}</tr></thead><tbody>{Array.from({ length: 5 }).map((_, r) => <tr key={r}>{Array.from({ length: 5 }).map((_, c) => <td key={c}><Skeleton width={['60%','80%','40%','70%','50%'][c]} height="0.8rem" /></td>)}</tr>)}</tbody></table></div>
    </div>
  );

  const accountLabels: Record<string, string> = {
    asset: 'Aset', liability: 'Liabilitas', equity: 'Ekuitas',
    revenue: 'Pendapatan', cogs: 'HPP', expense: 'Beban',
  };

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Buku Besar</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Rincian mutasi setiap akun
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input input-sm" style={{ width: 'auto' }} value={selectedCode} onChange={(e) => setSelectedCode(e.target.value)}>
            <option value="">— Semua Akun —</option>
            {accounts.map(a => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <div className="period-bar">
            {periods.map(p => (
              <button key={p.days} className={`period-btn${days === p.days ? ' active' : ''}`} onClick={() => setDays(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data?.account && (
        <div className="card card-p">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{data.account.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {data.account.code} — {accountLabels[data.account.type] || data.account.type}
                <InfoTip text={data.account.normal_balance === 'debit' ? 'Akun ini bertambah di sisi Debit' : 'Akun ini bertambah di sisi Kredit'} />
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>
              {fmtRp(data.account.balance)}
            </div>
          </div>
        </div>
      )}

      {!data || data.entries.length === 0 ? (
        <EmptyState icon="📓" title="Belum Ada Transaksi" text={selectedCode ? 'Akun ini belum memiliki transaksi di periode tersebut.' : 'Belum ada jurnal yang tercatat.'} />
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Tipe</th>
                <th>Deskripsi</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Kredit</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.entry_date).toLocaleDateString('id-ID')}</td>
                  <td><span className="badge badge-blue">{e.reference_type}</span></td>
                  <td>{e.description || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{e.debit > 0 ? fmtRp(e.debit) : '-'}</td>
                  <td style={{ textAlign: 'right' }}>{e.credit > 0 ? fmtRp(e.credit) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
