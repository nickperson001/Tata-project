import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toast } from '../../components/Toast';
import { useStockToken } from '../../hooks/useStockToken';
import { useStockStore } from '../../store/stockStore';
import { NotificationBell } from '../../components/NotificationBell';
import { UserMenu } from '../../components/UserMenu';
import {
  LayoutDashboard, BookOpen, Package, BarChart3,
  History, Box, TrendingUp, Settings, Database,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { StockLogin } from './StockLogin';
import { QuickActions } from '../../components/QuickActions';
import { getSocket, disconnectSocket } from '../../services/socket';
import { useNotificationStore, StockAlert } from '../../store/notificationStore';
import { stockApi } from '../../services/api';

interface NavLeaf {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

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

function getNavGroups(status?: string): NavGroup[] {
  const allGroups: NavGroup[] = [
    {
      label: 'Keuangan', icon: BookOpen,
      children: [
        { to: '/stock/keuangan', label: 'Laporan Keuangan', icon: BookOpen },
      ],
    },
    {
      label: 'Inventori', icon: Package,
      children: [
        { to: '/stock/products', label: 'Produk', icon: Package },
        { to: '/stock/materials', label: 'Bahan Baku', icon: Box },
        { to: '/stock/history', label: 'Riwayat', icon: History },
        { to: '/stock/product-stats', label: 'Analisa Produk', icon: TrendingUp },
      ],
    },
    {
      label: 'Laporan', icon: BarChart3,
      children: [
        { to: '/stock/report', label: 'Laporan Stok', icon: BarChart3 },
        { to: '/stock/batch', label: 'Data Lengkap', icon: Database },
      ],
    },
  ];
  if (status === 'demo') return [allGroups[1]];
  return allGroups;
}

function isActive(pathname: string, to: string) {
  if (to === '/stock') return pathname === '/stock';
  const segs = pathname.split('/');
  const tSegs = to.split('/');
  return tSegs.every((s, i) => segs[i] === s);
}

export function StockLayout() {
  const { isLoading } = useStockToken();
  const { token, user } = useStockStore();
  const location = useLocation();
  const navigate = useNavigate();

  const navGroups = useMemo(() => getNavGroups(user?.status), [user?.status]);

  const subChildren = useMemo(() => {
    const group = navGroups.find(g => g.children.some(c => isActive(location.pathname, c.to)));
    return group?.children ?? [];
  }, [location.pathname, navGroups]);

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

  // PWA install prompt handler
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__tbsDeferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__spinner" />
        <span className="loading-screen__text">Memuat dashboard...</span>
      </div>
    );
  }

  if (!token) {
    return <StockLogin />;
  }

  return (
    <div className="stock-layout">
      <div className="stock-main">
        <div className="stock-shell-head">
          <header className="stock-topbar">
            <div className="topbar-left">
              <img src="/stock/logo.svg" alt="Tata" className="topbar-logo" />
              <div className="topbar-brand-stack">
                <span className="topbar-brand">Tata Business Suite</span>
                <span className="topbar-kicker">Stok, kas, dan laporan dalam satu tempat</span>
              </div>
            </div>
            <div className="topbar-right">
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
        </div>

        <main className="stock-content stock-content-shell content-fade">
          <Outlet />
        </main>
      </div>

      <nav className="stock-bottom-nav">
        {bottomNav.slice(0, bottomNav.length <= 3 ? 1 : 2).map(item => (
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

        <div className="bnav-fab-cell">
          <QuickActions inNav />
        </div>

        {bottomNav.slice(bottomNav.length <= 3 ? 1 : 2).map(item => (
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
    </div>
  );
}
