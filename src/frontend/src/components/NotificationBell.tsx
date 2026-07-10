import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore, StockAlert } from '../store/notificationStore';
import { stockApi } from '../services/api';
import { useStockStore } from '../store/stockStore';
import { Portal } from '../lib/Portal';
import { Z } from '../lib/zIndex';

export function NotificationBell() {
  const { token } = useStockStore();
  const { alerts, unreadCount, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!token) return;
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
    return () => { clearInterval(interval); };
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

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const unresolved = alerts.filter((a) => !a.resolved_at);
  const displayAlerts = unresolved.slice(0, 10);

  function handleToggle() {
    if (!open) {
      markAllRead();
    }
    setOpen(!open);
  }

  return (
    <div ref={ref} className="notif-bell-wrap">
      <button
        ref={btnRef}
        className="btn btn-ghost btn-sm"
        onClick={handleToggle}
        aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <Portal>
          <div className="dropdown-backdrop" style={{ zIndex: Z.DROPDOWN_BACKDROP }} onClick={close} />
          <div
            className="notif-dropdown"
            role="menu"
            aria-label="Daftar notifikasi"
            style={{ zIndex: Z.DROPDOWN }}
          >
            <div className="notif-header">Notifikasi</div>
            {displayAlerts.length === 0 ? (
              <div className="notif-empty">Tidak ada notifikasi</div>
            ) : (
              displayAlerts.map((alert) => (
                <div key={alert.id} role="menuitem" className="notif-item">
                  <div className={`notif-type ${alert.alert_type === 'out_of_stock' ? 'notif-danger' : 'notif-warning'}`}>
                    {alert.alert_type === 'out_of_stock' ? 'Stok Habis' : 'Stok Menipis'}
                  </div>
                  <div className="notif-detail">
                    {alert.products?.name || `Produk #${alert.product_id}`} — {alert.stock_level} tersisa
                  </div>
                </div>
              ))
            )}
          </div>
        </Portal>
      )}
    </div>
  );
}
