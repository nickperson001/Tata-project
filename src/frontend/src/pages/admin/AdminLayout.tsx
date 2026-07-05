import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../services/socket';
import { useAdminStore } from '../../store/adminStore';
import type { BotState, LogEntry } from '../../types';
import { LayoutDashboard, Users, Send, Terminal } from 'lucide-react';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

const navItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/database', label: 'Database', icon: Users },
  { to: '/admin/broadcast', label: 'Broadcast', icon: Send },
  { to: '/admin/terminal', label: 'Terminal', icon: Terminal },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, checkSession, logout } = useAuthStore();
  const { botState, setBotState, addLog, setLogs } = useAdminStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();

    socket.on('bot_update', (data: BotState) => {
      setBotState(data);
    });

    socket.on('system_log', (log: LogEntry) => {
      addLog(log);
    });

    socket.on('logs_history', (logs: LogEntry[]) => {
      setLogs(logs.reverse());
    });

    return () => {
      socket.off('bot_update');
      socket.off('system_log');
      socket.off('logs_history');
    };
  }, [isAuthenticated, setBotState, addLog, setLogs]);

  if (isLoading) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <div className="skel" style={{ width: '60%', height: '2rem', marginBottom: '1rem' }} />
        <div className="skel" style={{ width: '100%', height: 200, borderRadius: 'var(--radius)' }} />
      </div>
    );
  }

  if (!isAuthenticated) return <></>;

  return (
    <div className="admin-layout">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <img src="/stock/logo.svg" alt="Tata" className="admin-topbar-brand-img" />
          <div>
            <div className="admin-topbar-brand-name">Tata</div>
            <div className="admin-topbar-brand-sub">Business Suite</div>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <LanguageSwitcher />
          <button className="btn btn-ghost btn-sm" onClick={() => logout().then(() => navigate('/login'))}
            style={{ color: 'var(--text-muted)' }}>
            Keluar
          </button>
        </div>
      </header>

      <nav className="admin-bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="admin-bottom-link"
            style={({ isActive }) => ({
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent',
            })}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="admin-main content-fade">
        <Outlet />
      </main>
    </div>
  );
}
