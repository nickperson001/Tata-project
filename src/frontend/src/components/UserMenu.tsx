import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockStore } from '../store/stockStore';
import { useTheme } from '../hooks/useTheme';
import { Badge } from './Badge';
import { Sun, Moon, Settings, LogOut, User } from 'lucide-react';

export function UserMenu() {
  const { user } = useStockStore();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm"
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.85rem',
        }}
        onClick={() => setOpen(!open)}
        title={user?.store_name || 'User'}
      >
        {(user?.store_name || 'U').charAt(0).toUpperCase()}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 6,
            width: 220,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,.15)',
            zIndex: 1000, overflow: 'hidden',
          }}>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={14} />
                {user?.store_name || 'User'}
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <Badge variant={user?.status}>{user?.status || 'demo'}</Badge>
              </div>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 0, fontSize: '0.85rem' }}
              onClick={() => { toggle(); setOpen(false); }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              {isDark ? 'Mode Terang' : 'Mode Gelap'}
            </button>

            <button
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 0, fontSize: '0.85rem' }}
              onClick={() => { navigate('/stock/settings'); setOpen(false); }}
            >
              <Settings size={16} />
              Pengaturan
            </button>

            <button
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 0, fontSize: '0.85rem' }}
              onClick={() => { navigate('/stock/bantuan'); setOpen(false); }}
            >
              <HelpCircle size={16} />
              Bantuan
            </button>

            <div style={{ borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 0, fontSize: '0.85rem', color: 'var(--danger)' }}
                onClick={() => { localStorage.removeItem('tbs_token'); window.location.reload(); }}
              >
                <LogOut size={16} />
                Keluar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
