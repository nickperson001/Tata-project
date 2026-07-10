import { useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { toast } from '../../components/Toast';
import { useStockToken } from '../../hooks/useStockToken';
import { useStockStore } from '../../store/stockStore';
import { NotificationBell } from '../../components/NotificationBell';
import { UserMenu } from '../../components/UserMenu';
import { HelpCircle, Settings } from 'lucide-react';
import { ChatbotWidget } from './ChatbotWidget';
import { StockLogin } from './StockLogin';
import { getSocket, disconnectSocket } from '../../services/socket';
import { useNotificationStore, StockAlert } from '../../store/notificationStore';
import { stockApi } from '../../services/api';
import {
  LayoutDashboard, BookOpen, Package, BarChart3,
} from 'lucide-react';

const BOTTOM_NAV_ALL = [
  { to: '/stock', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/stock/keuangan', label: 'Keuangan', icon: BookOpen },
  { to: '/stock/products', label: 'Inventori', icon: Package },
  { to: '/stock/report', label: 'Laporan', icon: BarChart3 },
];

const BOTTOM_NAV_DEMO = [
  { to: '/stock', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/stock/products', label: 'Inventori', icon: Package },
  { to: '/stock/settings', label: 'Settings', icon: Settings },
];

export function StockLayout() {
  const { isLoading } = useStockToken();
  const { token, user } = useStockStore();
  const navigate = useNavigate();

  const bottomNav = user?.status === 'demo' ? BOTTOM_NAV_DEMO : BOTTOM_NAV_ALL;

  const userIdRef = useRef<string | undefined>(undefined);
  const shownAlertIds = useRef(new Set<string>());
  const registerUser = useCallback(() => {
    if (user?.id) getSocket().emit('register_user', user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    userIdRef.current = user.id;
    const socket = getSocket();

    registerUser();
    socket.on('connect', registerUser);

    const handler = (data: { userId: string; productId: string; alertType: string; stockLevel: number; products?: { name: string } }) => {
      if (userIdRef.current !== data.userId) return;
      const dedupKey = `${data.productId}-${data.alertType}-${data.stockLevel}`;
      if (shownAlertIds.current.has(dedupKey)) return;
      shownAlertIds.current.add(dedupKey);
      setTimeout(() => shownAlertIds.current.delete(dedupKey), 6000);

      const productName = data.products?.name || `Produk #${data.productId}`;
      if (data.alertType === 'out_of_stock') {
        toast.error(`Stok Habis — ${productName} (${data.stockLevel} tersisa)`, { duration: 5000 });
      } else {
        toast(`Stok Menipis — ${productName} (${data.stockLevel} tersisa)`, { duration: 5000 });
      }
      const currentToken = useStockStore.getState().token;
      if (currentToken) {
        stockApi.get<{ alerts: StockAlert[] }>('/api/stock/alerts', currentToken).then((res) => {
          if (res.alerts) {
            useNotificationStore.getState().setAlerts(res.alerts);
          }
        }).catch(() => {});
      }
    };
    socket.on('stock_alert', handler);
    return () => {
      socket.off('stock_alert', handler);
      socket.off('connect', registerUser);
    };
  }, [user?.id, registerUser]);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <div className="spinner" style={{ width: 48, height: 48, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Memuat dashboard...</span>
      </div>
    );
  }

  if (!token) {
    return <StockLogin />;
  }

  return (
    <div className="stock-layout">
      <div className="stock-main">
        <header className="stock-topbar">
          <div className="topbar-left">
            <img src="/stock/logo.svg" alt="Tata" style={{ height: 22, marginRight: 6 }} />
            <span className="topbar-brand">Tata Business Suite</span>
            {user && <span className="topbar-store">— {user.store_name}</span>}
          </div>
          <div className="topbar-right">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/stock/bantuan')}
              title="Bantuan"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
            >
              <HelpCircle size={18} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/stock/settings')}
              title="Settings"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
            >
              <Settings size={18} />
            </button>
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="stock-content content-fade">
          <Outlet />
        </main>
      </div>

      <nav className="stock-bottom-nav">
        {bottomNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/stock'}
            className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <ChatbotWidget />
    </div>
  );
}
