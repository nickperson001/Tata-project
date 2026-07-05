import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore, StockAlert } from '../store/notificationStore';
import { stockApi } from '../services/api';
import { useStockStore } from '../store/stockStore';

export function NotificationBell() {
  const { token } = useStockStore();
  const { alerts, unreadCount, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const currentToken: string = token;
    function fetchAlerts() {
      stockApi.get<{ alerts: StockAlert[] }>('/api/stock/alerts', currentToken).then((res) => {
        if (res.alerts) {
          useNotificationStore.getState().setAlerts(res.alerts);
        }
      }).catch(() => {});
    }
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unresolved = alerts.filter((a) => !a.resolved_at);
  const displayAlerts = unresolved.slice(0, 10);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => { setOpen(!open); markAllRead(); }}
        aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: -2, right: -2,
              background: 'var(--danger)', color: '#fff',
              fontSize: '0.65rem', fontWeight: 700,
              width: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Daftar notifikasi"
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4,
            width: 320, maxHeight: 400, overflowY: 'auto',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,.15)',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '0.5rem 0.75rem', fontWeight: 700, borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
            Notifikasi
          </div>
          {displayAlerts.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Tidak ada notifikasi
            </div>
          ) : (
            displayAlerts.map((alert) => (
              <div key={alert.id} role="menuitem" style={{
                padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)',
                fontSize: '0.8rem',
              }}>
                <div style={{ fontWeight: 600, color: alert.alert_type === 'out_of_stock' ? 'var(--danger)' : 'var(--warning)' }}>
                  {alert.alert_type === 'out_of_stock' ? 'Stok Habis' : 'Stok Menipis'}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  {alert.products?.name || `Produk #${alert.product_id}`} — {alert.stock_level} tersisa
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
