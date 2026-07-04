import { useEffect, useState, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { Pagination } from '../../components/Pagination';
import { Badge } from '../../components/Badge';
import { ConfirmModal } from '../../components/ConfirmModal';
import { toast } from '../../components/Toast';
import { fmtRp, fmtQty, fmtDateTime } from '../../lib/utils';
import type { StockMovement, PaginationMeta } from '../../types';
import { Search, Trash2 } from 'lucide-react';

export function StockHistory() {
  const { token } = useStockStore();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 1, total: 0, limit: 30 });
  const [filterType, setFilterType] = useState('');
  const [filterProduct, setFilterProduct] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '30' });
      if (filterType) params.set('type', filterType);
      if (filterProduct) params.set('product_id', filterProduct);
      const data = await stockApi.get<{ movements: StockMovement[]; total: number; page: number; limit: number }>(
        `/api/stock/movements?${params}`, token,
      );
      setMovements(data.movements || []);
      setMeta({
        page: data.page,
        totalPages: Math.ceil((data.total || 0) / Math.max(data.limit, 1)) || 1,
        total: data.total || 0,
        limit: data.limit,
      });
    } catch {
      toast.error('Gagal memuat riwayat');
    } finally {
      setLoading(false);
    }
  }, [token, page, filterType, filterProduct]);

  const [showConfirmHapus, setShowConfirmHapus] = useState<string | null>(null);

  async function hapusMovement(id: string) {
    if (!token) return;
    try {
      await stockApi.del(`/api/stock/movement/${id}`, token);
      toast('Pergerakan stok dihapus');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal hapus');
    }
  }

  useEffect(() => { load(); }, [load]);

  function typeLabel(t: string) {
    const labels: Record<string, string> = { in: 'Masuk', out: 'Keluar', adjustment: 'Penyesuaian' };
    return labels[t] || t;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Riwayat Stok</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Log pergerakan stok</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <select className="input input-sm" style={{ width: 'auto' }} value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">Semua Tipe</option>
          <option value="in">Masuk</option>
          <option value="out">Keluar</option>
          <option value="adjustment">Penyesuaian</option>
        </select>
        <input
          className="input input-sm"
          placeholder="Cari produk..."
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          style={{ width: 200 }}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : movements.length === 0 ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada riwayat pergerakan stok
        </div>
      ) : (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Produk</th>
                  <th>Tipe</th>
                  <th>Jumlah</th>
                  <th>Harga</th>
                  <th>Catatan</th>
                  <th style={{ width: 60 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: '0.8rem' }}>{fmtDateTime(m.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{m.products?.name || m.product_id}</td>
                    <td>
                      <Badge variant={m.type === 'in' ? 'active' : m.type === 'out' ? 'habis' : 'menipis'}>
                        {typeLabel(m.type)}
                      </Badge>
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmtQty(m.quantity, m.products?.unit)}</td>
                    <td>{m.unit_price ? fmtRp(m.unit_price) : '-'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.note || '-'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} title="Hapus" onClick={() => setShowConfirmHapus(m.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} onPage={setPage} />
        </>
      )}

      <ConfirmModal
        open={!!showConfirmHapus}
        title="Hapus Pergerakan Stok"
        message="Yakin hapus pergerakan stok ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        danger
        onConfirm={() => { if (showConfirmHapus) { hapusMovement(showConfirmHapus); setShowConfirmHapus(null); } }}
        onCancel={() => setShowConfirmHapus(null)}
      />
    </div>
  );
}
