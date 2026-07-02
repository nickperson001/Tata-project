import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../services/socket';
import { useAdminStore } from '../../store/adminStore';
import type { BotState, LogEntry } from '../../types';
import { LayoutDashboard, Users, Send, Terminal } from 'lucide-react';

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
    <div style={{ minHeight: '100vh' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/stock/logo.svg" alt="Tata" style={{ height: 28 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Tata</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Business Suite</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => logout().then(() => navigate('/login'))}
          style={{ color: 'var(--text-muted)' }}>
          Keluar
        </button>
      </div>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', padding: '0.5rem',
      }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              padding: '0.5rem 0.75rem', borderRadius: '8px',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '0.65rem', fontWeight: 600,
              textDecoration: 'none',
              background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent',
            })}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="admin-main content-fade">
        <Outlet />
      </main>
    </div>
  );
}
