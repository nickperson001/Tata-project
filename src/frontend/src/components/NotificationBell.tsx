import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle } from 'lucide-react';
import { useNotificationStore, StockAlert } from '../store/notificationStore';
import { stockApi } from '../services/api';
import { useStockStore } from '../store/stockStore';
import { Portal } from '../lib/Portal';
import { Z } from '../lib/zIndex';
import { fmtRp } from '../lib/utils';

interface OverviewAlert {
  id: string;
  type: 'out_of_stock' | 'low_stock' | 'overdue_debt';
  label: string;
  detail: string;
  link: string;
}

export function NotificationBell() {
  const { token } = useStockStore();
  const navigate = useNavigate();
  const { alerts, unreadCount, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const [overviewAlerts, setOverviewAlerts] = useState<OverviewAlert[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  // Fetch stock alerts from DB
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

  // Fetch overview + hutang for "Perlu Perhatian" alerts
  useEffect(() => {
    if (!token) return;
    const currentToken: string = token;
    async function fetchOverviewAlerts() {
      try {
        const [oRes, hRes] = await Promise.all([
          stockApi.get<{ stok_habis: number; stok_menipis: number; total_product: number }>('/api/stock/overview?period=day', currentToken),
          stockApi.get<{ list: { nama_supplier: string; jatuh_tempo: string | null; nominal_hutang: number; jumlah_dibayar: number }[] }>('/api/stock/hutang?status=unpaid', currentToken),
        ]);
        const items: OverviewAlert[] = [];
        if (oRes.stok_habis > 0) items.push({ id: 'ov-out', type: 'out_of_stock', label: 'Stok Habis', detail: `${oRes.stok_habis} produk stok habis`, link: '/stock/products' });
        if (oRes.stok_menipis > 0) items.push({ id: 'ov-low', type: 'low_stock', label: 'Stok Menipis', detail: `${oRes.stok_menipis} produk menipis`, link: '/stock/products' });
        if (hRes?.list) {
          hRes.list
            .filter(item => item.jatuh_tempo && new Date(item.jatuh_tempo) < new Date())
            .forEach(item => {
              items.push({ id: `ov-debt-${item.nama_supplier}`, type: 'overdue_debt', label: item.nama_supplier, detail: `Hutang ${fmtRp(item.nominal_hutang - item.jumlah_dibayar)} sudah jatuh tempo`, link: '/stock/hutang' });
            });
        }
        setOverviewAlerts(items);
      } catch { /* non-critical */ }
    }
    fetchOverviewAlerts();
    const interval = setInterval(fetchOverviewAlerts, 30_000);
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
  const totalAlertCount = unreadCount + overviewAlerts.length;

  function handleToggle() {
    if (!open) {
      markAllRead();
      stockApi.patch('/api/stock/alerts/read', token!).catch(() => {});
    }
    setOpen(!open);
  }

  return (
    <div ref={ref} className="notif-bell-wrap">
      <button
        ref={btnRef}
        className="btn btn-ghost btn-sm"
        onClick={handleToggle}
        aria-label={`Notifikasi${totalAlertCount > 0 ? ` (${totalAlertCount} belum dibaca)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={18} />
        {totalAlertCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {totalAlertCount > 9 ? '9+' : totalAlertCount}
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

            {/* Overview alerts */}
            {overviewAlerts.length > 0 && (
              <>
                {overviewAlerts.map((item) => (
                  <div key={item.id} role="menuitem" className="notif-item" style={{ cursor: 'pointer', borderLeft: '3px solid var(--warning)' }}
                    onClick={() => { close(); navigate(item.link); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { close(); navigate(item.link); } }}
                    tabIndex={0}>
                    <div className={`notif-type notif-warning`}>
                      <AlertTriangle size={12} style={{ marginRight: 4 }} /> {item.label}
                    </div>
                    <div className="notif-detail">{item.detail}</div>
                  </div>
                ))}
                {displayAlerts.length > 0 && <div className="notif-divider" />}
              </>
            )}

            {/* Stock alerts from DB */}
            {displayAlerts.length === 0 && overviewAlerts.length === 0 ? (
              <div className="notif-empty">Tidak ada notifikasi</div>
            ) : (
              displayAlerts.map((alert) => (
                <div key={alert.id} role="menuitem" className="notif-item" style={{ cursor: 'pointer' }}
                  onClick={() => { close(); navigate('/stock/products'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { close(); navigate('/stock/products'); } }}
                  tabIndex={0}>
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