import { useEffect, useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { InfoTip } from '../../components/InfoTip';
import { fmtRp, fmtDate } from '../../lib/utils';
import { FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '../../components/Toast';
import type { JurnalData, JurnalEntryItem } from '../../types';

export function StockJurnal() {
  const { token } = useStockStore();
  const [data, setData] = useState<JurnalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const limit = 20;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    stockApi.get<JurnalData>(`/api/stock/jurnal?page=${page}&limit=${limit}`, token)
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : '[StockJurnal] Fetch gagal'))
      .finally(() => setLoading(false));
  }, [token, page]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Jurnal</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Daftar seluruh jurnal akuntansi</p>
      </div>
      <TableSkeleton rows={8} cols={6} />
    </div>
  );

  if (!data || data.list.length === 0)
    return <EmptyState icon="📓" title="Belum Ada Data" text="Belum ada jurnal yang tercatat." />;

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <FileText size={22} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
          Jurnal
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Daftar seluruh jurnal akuntansi — klik untuk melihat detail jurnal
          <InfoTip text="Jurnal adalah catatan transaksi double-entry. Setiap jurnal memiliki minimal 2 baris (debit dan kredit) dengan total yang sama." />
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Total {data.total} jurnal (hal. {data.page}/{totalPages})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.list.map(entry => {
          const open = expanded.has(entry.id);
          const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
          const totalKredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
          return (
            <div key={entry.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                onClick={() => toggleExpand(entry.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', cursor: 'pointer',
                  background: open ? 'var(--bg)' : 'transparent',
                  borderBottom: open ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ color: 'var(--text-muted)' }}>
                  {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{entry.description || '-'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                    <span>{fmtDate(entry.entry_date)}</span>
                    <span>{entry.reference_type}{entry.reference_id ? ` #${entry.reference_id}` : ''}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 600 }}>{fmtRp(totalDebit)}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{entry.lines.length} baris</div>
                </div>
              </div>
              {open && (
                <div style={{ padding: '0.5rem 1rem 0.75rem 2.5rem' }}>
                  <table style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Akun</th>
                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Nama Akun</th>
                        <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>Debit</th>
                        <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>Kredit</th>
                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map(line => (
                        <tr key={line.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, padding: '0.3rem 0.5rem' }}>
                            {line.account_code}
                          </td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>{line.account_name}</td>
                          <td style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: line.debit > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                            {line.debit > 0 ? fmtRp(line.debit) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: line.credit > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                            {line.credit > 0 ? fmtRp(line.credit) : '-'}
                          </td>
                          <td style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {line.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>Total</td>
                        <td style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--primary)' }}>{fmtRp(totalDebit)}</td>
                        <td style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--primary)' }}>{fmtRp(totalKredit)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
          let p: number;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button
              key={p}
              className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          );
        })}
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= totalPages}
          onClick={() => setPage(p => p + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
