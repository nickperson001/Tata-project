import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Skeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PromptModal } from '../../components/PromptModal';
import { Badge } from '../../components/Badge';
import { toast } from '../../components/Toast';
import { fmtRp, fmtDate } from '../../lib/utils';
import type { HutangItem } from '../../types';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface HutangList {
  totalHutang: number;
  belumLunas: number;
  sudahLunas: number;
  jumlahTagihan: number;
  list: HutangItem[];
}

export function StockHutang() {
  const { token } = useStockStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HutangItem | null>(null);
  const [form, setForm] = useState({ nama_supplier: '', nominal_hutang: '', deskripsi: '', jatuh_tempo: '' });

  const query = useQuery({
    queryKey: ['hutang', token],
    queryFn: () => stockApi.get<HutangList>('/api/stock/hutang', token!),
    enabled: !!token,
  });

  const data = query.data ?? null;
  const loading = query.isPending;

  function openCreate() {
    setEditing(null);
    setForm({ nama_supplier: '', nominal_hutang: '', deskripsi: '', jatuh_tempo: '' });
    setShowModal(true);
  }

  function openEdit(item: HutangItem) {
    setEditing(item);
    setForm({
      nama_supplier: item.nama_supplier,
      nominal_hutang: String(item.nominal_hutang),
      deskripsi: item.deskripsi || '',
      jatuh_tempo: item.jatuh_tempo ? item.jatuh_tempo.slice(0, 10) : '',
    });
    setShowModal(true);
  }

  async function save() {
    if (!token) return;
    try {
      if (editing) {
        await stockApi.put(`/api/stock/hutang/${editing.id}`, token, {
          nama_supplier: form.nama_supplier,
          nominal_hutang: Number(form.nominal_hutang),
          deskripsi: form.deskripsi,
          jatuh_tempo: form.jatuh_tempo || null,
        });
        toast('Hutang diupdate');
      } else {
        await stockApi.post('/api/stock/hutang', token, {
          nama_supplier: form.nama_supplier,
          nominal_hutang: Number(form.nominal_hutang),
          deskripsi: form.deskripsi,
          jatuh_tempo: form.jatuh_tempo || null,
        });
        toast('Hutang dicatat');
      }
      setShowModal(false);
      query.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    }
  }

  const [showBayar, setShowBayar] = useState<HutangItem | null>(null);
  const [showConfirmHapus, setShowConfirmHapus] = useState<string | null>(null);

  async function prosesBayar(item: HutangItem, nominalStr: string) {
    if (!token) return;
    const bayarNominal = Number(nominalStr);
    if (isNaN(bayarNominal) || bayarNominal <= 0) { toast.error('Jumlah tidak valid'); return; }
    try {
      const totalDibayar = item.jumlah_dibayar + bayarNominal;
      const lunas = totalDibayar >= item.nominal_hutang;
      await stockApi.put(`/api/stock/hutang/${item.id}`, token, {
        jumlah_dibayar: Math.min(totalDibayar, item.nominal_hutang),
        status_lunas: lunas,
      });
      toast(lunas ? 'Hutang lunas!' : 'Pembayaran dicatat');
      query.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    }
  }

  async function hapus(id: string) {
    if (!token) return;
    try {
      await stockApi.del(`/api/stock/hutang/${id}`, token);
      toast('Hutang dihapus');
      query.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal hapus');
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Hutang</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Management hutang ke supplier</p>
        </div>
        <Skeleton width="130px" height="2rem" />
      </div>
      <div className="grid grid-3" style={{ gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-p"><Skeleton count={2} /></div>)}
      </div>
      <div className="tbl-wrap"><table><thead><tr>{['Supplier','Jumlah','Sisa','Jatuh Tempo','Status','Aksi'].map(h => <th key={h}><Skeleton width="70%" height="0.8rem" /></th>)}</tr></thead><tbody>{Array.from({ length: 5 }).map((_, r) => <tr key={r}>{Array.from({ length: 6 }).map((_, c) => <td key={c}><Skeleton width={['60%','80%','40%','70%','50%','30%'][c]} height="0.8rem" /></td>)}</tr>)}</tbody></table></div>
    </div>
  );

  return (
    <div className="data-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Hutang</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Management hutang ke supplier</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={16} /> Catat Hutang
        </button>
      </div>

      {!data ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Belum ada data hutang
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
              Tidak ada hutang
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Jumlah</th>
                    <th>Sisa</th>
                    <th>Jatuh Tempo</th>
                    <th>Status</th>
                    <th style={{ width: 140 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.list.map((item) => {
                    const sisa = item.nominal_hutang - item.jumlah_dibayar;
                    const isOverdue = item.jatuh_tempo && !item.status_lunas && new Date(item.jatuh_tempo) < new Date();
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.nama_supplier}</td>
                        <td style={{ fontWeight: 700 }}>{fmtRp(item.nominal_hutang)}</td>
                        <td style={{ fontWeight: 700, color: sisa > 0 ? 'var(--danger)' : 'var(--primary)' }}>
                          {fmtRp(Math.max(0, sisa))}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {item.jatuh_tempo ? fmtDate(item.jatuh_tempo) : '-'}
                          {isOverdue && <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>⏰</span>}
                        </td>
                        <td>
                          <Badge variant={item.status_lunas ? 'lunas' : isOverdue ? 'overdue' : 'belum'}>
                            {item.status_lunas ? 'Lunas' : isOverdue ? 'Overdue' : 'Belum'}
                          </Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            {!item.status_lunas && (
                              <button className="btn btn-success btn-sm" onClick={() => setShowBayar(item)}>
                                Bayar
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(item)}>
                              <Pencil size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} title="Hapus" onClick={() => setShowConfirmHapus(item.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Hutang' : 'Catat Hutang Baru'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Nama Supplier</label>
            <input className="input" value={form.nama_supplier} onChange={(e) => setForm({ ...form, nama_supplier: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Jumlah Hutang (Rp)</label>
            <input className="input" type="number" min="0" value={form.nominal_hutang} onChange={(e) => setForm({ ...form, nominal_hutang: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="input" value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Misal: pasok kopi 50kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Jatuh Tempo (opsional)</label>
            <input className="input" type="date" value={form.jatuh_tempo} onChange={(e) => setForm({ ...form, jatuh_tempo: e.target.value })} />
          </div>
        </div>
      </Modal>

      <PromptModal
        open={!!showBayar}
        title="Bayar Hutang"
        message={`Bayar hutang ke ${showBayar?.nama_supplier} (sisa: ${showBayar ? fmtRp(showBayar.nominal_hutang - showBayar.jumlah_dibayar) : 'Rp0'})`}
        defaultValue={showBayar ? String(showBayar.nominal_hutang - showBayar.jumlah_dibayar) : ''}
        confirmLabel="Bayar"
        onConfirm={(v) => { if (showBayar) { prosesBayar(showBayar, v); setShowBayar(null); } }}
        onCancel={() => setShowBayar(null)}
      />

      <ConfirmModal
        open={!!showConfirmHapus}
        title="Hapus Hutang"
        message="Yakin hapus hutang ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        danger
        onConfirm={() => { if (showConfirmHapus) { hapus(showConfirmHapus); setShowConfirmHapus(null); } }}
        onCancel={() => setShowConfirmHapus(null)}
      />
    </div>
  );
}