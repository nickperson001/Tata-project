import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { Badge } from '../../components/Badge';
import { fmtRp, fmtDate } from '../../lib/utils';
import { DollarSign, Eye } from 'lucide-react';

interface PiutangList {
  totalPiutang: number;
  belumLunas: number;
  sudahLunas: number;
  jumlahTagihan: number;
  list: Array<{ nama: string; status: string; tanggal: string; jumlah: number }>;
}

export function StockPiutang() {
  const { token } = useStockStore();
  const [data, setData] = useState<PiutangList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    stockApi.get<PiutangList>('/api/stock/piutang', token)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Piutang</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Management piutang pelanggan</p>
      </div>
      <div className="grid grid-3" style={{ gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
      </div>
      <div className="tbl-wrap"><table><thead><tr>{['Pelanggan','Jumlah','Tanggal','Status'].map(h => <th key={h}><Skeleton width="80%" height="0.8rem" /></th>)}</tr></thead><tbody>{Array.from({ length: 5 }).map((_, r) => <tr key={r}>{Array.from({ length: 4 }).map((_, c) => <td key={c}><Skeleton width={`${60 + Math.random() * 30}%`} height="0.8rem" /></td>)}</tr>)}</tbody></table></div>
    </div>
  );

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Piutang</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Management piutang pelanggan</p>
      </div>

      {!data ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada data piutang
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ gap: '1rem' }}>
            <div className="card card-p">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmtRp(data.belumLunas)}</div>
              <div className="stat-label">Belum Lunas</div>
            </div>
            <div className="card card-p">
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{fmtRp(data.sudahLunas)}</div>
              <div className="stat-label">Sudah Lunas</div>
            </div>
            <div className="card card-p">
              <div className="stat-value">{data.jumlahTagihan}</div>
              <div className="stat-label">Total Tagihan</div>
            </div>
          </div>

          {data.list.length === 0 ? (
            <div className="card card-p" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Tidak ada tagihan
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th>Jumlah</th>
                    <th>Tanggal</th>
                    <th>Status</th>
                    <th style={{ width: 80 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.list.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{item.nama}</td>
                      <td style={{ fontWeight: 700 }}>{fmtRp(item.jumlah)}</td>
                      <td style={{ fontSize: '0.8rem' }}>{fmtDate(item.tanggal)}</td>
                      <td>
                        <Badge variant={item.status === 'paid' ? 'lunas' : 'belum'}>
                          {item.status === 'paid' ? 'Lunas' : 'Belum'}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm" title="Lihat Detail">
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
