import { useEffect, useState, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { InfoTip } from '../../components/InfoTip';
import { FilterBar } from '../../components/FilterBar';
import type { DateRange } from '../../components/DateRangeFilter';
import { fmtRp } from '../../lib/utils';
import { DownloadButton } from '../../components/DownloadButton';
import type { NeracaData } from '../../types';

export function StockNeraca() {
  const { token, user } = useStockStore();
  const [data, setData] = useState<NeracaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, preset: 'today' });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = '/api/stock/neraca';
      if (dateRange.endDate) {
        url += '?end_date=' + encodeURIComponent(dateRange.endDate);
      }
      const d = await stockApi.get<NeracaData>(url, token);
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token, dateRange.endDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Neraca</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Posisi keuangan</p>
        </div>
        <Skeleton width="140px" height="2rem" />
      </div>
      <div className="neraca-grid">
        <div className="card card-p"><div className="neraca-side"><h3><Skeleton width="80px" height="1rem" /></h3>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="neraca-item"><Skeleton width="80%" height="0.8rem" /><Skeleton width="60px" height="0.8rem" /></div>)}<div className="neraca-total"><Skeleton width="100px" height="1rem" /><Skeleton width="80px" height="1rem" /></div></div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card card-p"><div className="neraca-side"><h3><Skeleton width="80px" height="1rem" /></h3>{Array.from({ length: 2 }).map((_, i) => <div key={i} className="neraca-item"><Skeleton width="80%" height="0.8rem" /><Skeleton width="60px" height="0.8rem" /></div>)}<div className="neraca-total"><Skeleton width="100px" height="1rem" /><Skeleton width="80px" height="1rem" /></div></div></div>
          <div className="card card-p"><div className="neraca-side"><h3><Skeleton width="80px" height="1rem" /></h3>{Array.from({ length: 2 }).map((_, i) => <div key={i} className="neraca-item"><Skeleton width="80%" height="0.8rem" /><Skeleton width="60px" height="0.8rem" /></div>)}<div className="neraca-total"><Skeleton width="100px" height="1rem" /><Skeleton width="80px" height="1rem" /></div></div></div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center' }}><Skeleton width="180px" height="0.8rem" style={{ margin: '0 auto' }} /><Skeleton width="120px" height="1.4rem" style={{ margin: '0.25rem auto 0' }} /></div>
        </div>
      </div>
    </div>
  );

  if (!data) return <EmptyState icon="⚖️" title="Belum Ada Data Neraca" text="Neraca akan tersedia setelah ada transaksi dan jurnal yang tercatat." />;

  if (user?.status === 'demo') {
    return (
      <div className="card card-p" style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: 480, margin: '2rem auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Fitur Neraca</h3>
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

  const seimbang = Math.abs(data.selisih) < 1;

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Neraca</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Posisi keuangan per {data.date}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className={`neraca-check ${seimbang ? 'ok' : 'ko'}`}>
            {seimbang ? '✅ Seimbang' : '⚠️ Tidak Seimbang'}
            <InfoTip text="Total Aset harus sama dengan total Liabilitas + Ekuitas. Ini prinsip dasar akuntansi double-entry." />
          </div>
          <DownloadButton url="/api/stock/export/neraca" filename="Neraca.xlsx" />
        </div>
      </div>

      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showSearch={false}
      />

      <div className="neraca-grid">
        <div className="card card-p">
          <div className="neraca-side">
            <h3>💼 Aset <InfoTip text="Semua kekayaan bisnis: kas, piutang, inventori, peralatan, dll." /></h3>
            {data.aset.items.map(item => (
              <div key={item.code} className="neraca-item">
                <span className="n-name">{item.code} — {item.name}</span>
                <span className="n-amt">{fmtRp(item.absolute)}</span>
              </div>
            ))}
            <div className="neraca-total">
              <span>Total Aset</span>
              <span>{fmtRp(data.aset.total)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card card-p">
            <div className="neraca-side">
              <h3>🧾 Liabilitas <InfoTip text="Semua hutang dan kewajiban bisnis kepada pihak lain." /></h3>
              {data.liabilitas.items.map(item => (
                <div key={item.code} className="neraca-item">
                  <span className="n-name">{item.code} — {item.name}</span>
                  <span className="n-amt">{fmtRp(item.absolute)}</span>
                </div>
              ))}
              {data.liabilitas.items.length === 0 && (
                <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tidak ada liabilitas</div>
              )}
              <div className="neraca-total">
                <span>Total Liabilitas</span>
                <span>{fmtRp(data.liabilitas.total)}</span>
              </div>
            </div>
          </div>

          <div className="card card-p">
            <div className="neraca-side">
              <h3>💰 Ekuitas <InfoTip text="Modal pemilik dan laba ditahan. Ini adalah 'hak' pemilik atas bisnis." /></h3>
              {data.ekuitas.items.map(item => (
                <div key={item.code} className="neraca-item">
                  <span className="n-name">{item.code} — {item.name}</span>
                  <span className="n-amt">{fmtRp(item.absolute)}</span>
                </div>
              ))}
              {data.ekuitas.items.length === 0 && (
                <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada setoran modal</div>
              )}
              <div className="neraca-total">
                <span>Total Ekuitas</span>
                <span>{fmtRp(data.ekuitas.total)}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', textAlign: 'center', background: seimbang ? 'var(--primary-light)' : '#fee2e2' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Liabilitas + Ekuitas</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: seimbang ? 'var(--primary-dark)' : '#991b1b' }}>
              {fmtRp(data.totalLiabilitasEkuitas)}
            </div>
            {!seimbang && (
              <div style={{ fontSize: '0.8rem', color: '#991b1b', marginTop: '0.25rem' }}>
                Selisih: {fmtRp(data.selisih)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
