import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { Badge, statusLabel } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { toast } from '../../components/Toast';
import type { User, SubscriptionTier, PaginationMeta } from '../../types';
import { Search } from 'lucide-react';

interface UserResponse {
  users: User[];
  meta: PaginationMeta;
}

export function DatabaseTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<UserResponse>(
        `/api/admin/users?page=${page}&search=${encodeURIComponent(search)}&status=${statusFilter}`,
      );
      setUsers(data.users);
      setMeta(data.meta);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat pengguna');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function setUserStatus(id: string, status: SubscriptionTier) {
    api.post(`/api/admin/user/${id}/status`, { status })
      .then(() => {
        toast(`Status diubah ke ${statusLabel(status)}`);
        loadUsers();
      })
      .catch((err) => toast.error(err.message));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Database Pengguna</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Kelola pengguna Tata Business Suite</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input input-sm"
              placeholder="Cari nama/WA..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: '2rem', width: 200 }}
            />
          </div>
          <select
            className="input input-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ width: 140 }}
          >
            <option value="all">Semua Status</option>
            <option value="demo">Demo</option>
            <option value="pro">Pro</option>
            <option value="unlimited">Unlimited</option>
          </select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : users.length === 0 ? (
        <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Tidak ada pengguna
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Toko</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Bergabung</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.store_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.slug || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Badge variant={u.status}>{statusLabel(u.status)}</Badge>
                      <select
                        className="input input-sm"
                        value={u.status}
                        onChange={(e) => setUserStatus(u.id, e.target.value as SubscriptionTier)}
                        style={{ width: 120 }}
                      >
                        <option value="demo">Demo</option>
                        <option value="pro">Pro</option>
                        <option value="unlimited">Unlimited</option>
                      </select>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(u.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setUserStatus(u.id, u.status === 'demo' ? 'pro' : 'demo')}>
                      {u.status === 'demo' ? 'Naikkan ke Pro' : u.status === 'pro' ? 'Naikkan ke Unlimited' : 'Turunkan ke Demo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}
