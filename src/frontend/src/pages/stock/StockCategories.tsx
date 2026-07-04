import { useEffect, useState, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Modal } from '../../components/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { toast } from '../../components/Toast';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export function StockCategories() {
  const token = useStockStore(s => s.token);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await stockApi.get<{ categories: Category[] }>('/api/stock/categories', token);
      setCategories(data.categories || []);
    } catch {
      toast.error('Gagal memuat kategori');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditCat(null);
    setName('');
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditCat(c);
    setName(c.name);
    setShowModal(true);
  }

  async function save() {
    if (!token || !name.trim()) return;
    try {
      if (editCat) {
        await stockApi.put(`/api/stock/categories/${editCat.id}`, token, { name: name.trim() });
        toast('Kategori diupdate');
      } else {
        await stockApi.post('/api/stock/categories', token, { name: name.trim() });
        toast('Kategori dibuat');
      }
      setShowModal(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal simpan kategori');
    }
  }

  async function confirmDelete() {
    if (!token || !deleteId) return;
    try {
      await stockApi.del(`/api/stock/categories/${deleteId}`, token);
      toast('Kategori dihapus');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal hapus kategori');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Kategori Produk</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Kelola kategori untuk pengelompokan produk</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : categories.length === 0 ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Package size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <div>Belum ada kategori. Klik "Tambah Kategori" untuk memulai.</div>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Kategori</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(c.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setDeleteId(c.id); setDeleteName(c.name); }} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editCat ? 'Edit Kategori' : 'Tambah Kategori'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Simpan</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Nama Kategori</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Makanan, Minuman, Elektronik" autoFocus />
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Hapus Kategori"
        message={`Yakin ingin menghapus kategori "${deleteName}"? Produk dengan kategori ini akan direset.`}
        confirmLabel="Hapus"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
