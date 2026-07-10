import { useEffect, useState, useMemo, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toast } from '../../components/Toast';
import { useStockToken } from '../../hooks/useStockToken';
import { useStockStore } from '../../store/stockStore';
import { NotificationBell } from '../../components/NotificationBell';
import { UserMenu } from '../../components/UserMenu';
import { HelpCircle } from 'lucide-react';
import { StockSidebar, getNavGroups, isActive } from './StockSidebar';
import { ChatbotWidget } from './ChatbotWidget';
import { StockLogin } from './StockLogin';
import { getSocket, disconnectSocket } from '../../services/socket';
import { useNotificationStore, StockAlert } from '../../store/notificationStore';
import { stockApi } from '../../services/api';
import {
  LayoutDashboard, BookOpen, Package, CreditCard, BarChart3, Settings,
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
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const navGroups = useMemo(() => getNavGroups(user?.status), [user?.status]);

  const subChildren = useMemo(() => {
    const group = navGroups.find(g => g.children.some(c => isActive(location.pathname, c.to)));
    return group?.children ?? [];
  }, [location.pathname, navGroups]);

  const bottomNav = user?.status === 'demo' ? BOTTOM_NAV_DEMO : BOTTOM_NAV_ALL;

  const userIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!user?.id) return;
    userIdRef.current = user.id;
    getSocket().emit('register_user', user.id);
      const handler = (data: { userId: string; productId: string; alertType: string; stockLevel: number }) => {
        if (userIdRef.current !== data.userId) return;
        const label = data.alertType === 'out_of_stock' ? 'Stok Habis' : 'Stok Menipis';
        toast.error(`${label} — Produk #${data.productId} (${data.stockLevel} tersisa)`, { duration: 5000 });
        const currentToken = token;
        if (currentToken) {
          stockApi.get<{ alerts: StockAlert[] }>('/api/stock/alerts', currentToken).then((res) => {
            if (res.alerts) {
              useNotificationStore.getState().setAlerts(res.alerts);
            }
          }).catch(() => {});
        }
      };
    getSocket().on('stock_alert', handler);
    return () => { getSocket().off('stock_alert', handler); };
  }, [user?.id]);

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
      <StockSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

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
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        {subChildren.length > 0 && (
          <nav className="stock-subnav">
            {subChildren.map(child => (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.to === '/stock'}
                className={({ isActive: act }) => `sn-item ${act ? 'active' : ''}`}
              >
                <child.icon size={15} />
                <span>{child.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

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
