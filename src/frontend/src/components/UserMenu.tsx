import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockStore } from '../store/stockStore';
import { useTheme } from '../hooks/useTheme';
import { Badge } from './Badge';
import { Portal } from '../lib/Portal';
import { Z } from '../lib/zIndex';
import { Sun, Moon, Settings, LogOut, User, HelpCircle } from 'lucide-react';

export function UserMenu() {
  const { user } = useStockStore();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
        if (items.length === 0) return;
        const current = document.activeElement;
        const idx = items.indexOf(current as HTMLButtonElement);
        let next: number;
        if (e.key === 'ArrowDown') {
          next = idx < items.length - 1 ? idx + 1 : 0;
        } else {
          next = idx > 0 ? idx - 1 : items.length - 1;
        }
        items[next]?.focus();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const menuItems = [
    { icon: isDark ? Sun : Moon, label: isDark ? 'Mode Terang' : 'Mode Gelap', onClick: () => { toggle(); close(); } },
    { icon: Settings, label: 'Pengaturan', onClick: () => { navigate('/stock/settings'); close(); } },
    { icon: HelpCircle, label: 'Bantuan', onClick: () => { navigate('/stock/bantuan'); close(); } },
  ];

  const setItemRef = (i: number) => (el: HTMLButtonElement | null) => { itemRefs.current[i] = el; };

  return (
    <div ref={ref} className="user-menu-wrap">
      <button
        ref={btnRef}
        className="btn btn-ghost btn-sm user-menu-avatar"
        onClick={() => setOpen(!open)}
        title={user?.store_name || 'User'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {(user?.store_name || 'U').charAt(0).toUpperCase()}
      </button>

      {open && (
        <Portal>
          <div className="dropdown-backdrop" style={{ zIndex: Z.DROPDOWN_BACKDROP }} onClick={close} />
          <div
            ref={menuRef}
            className="user-menu-dropdown"
            role="menu"
            aria-label="Menu pengguna"
            style={{ zIndex: Z.DROPDOWN }}
          >
            <div className="user-menu-header">
              <div className="user-menu-name">
                <User size={14} />
                {user?.store_name || 'User'}
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <Badge variant={user?.status}>{user?.status || 'demo'}</Badge>
              </div>
            </div>

            {menuItems.map((item, i) => (
              <button
                key={item.label}
                ref={setItemRef(i)}
                className="btn btn-ghost btn-sm user-menu-item"
                role="menuitem"
                onClick={item.onClick}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}

            <div className="user-menu-divider" />
            <button
              ref={setItemRef(menuItems.length)}
              className="btn btn-ghost btn-sm user-menu-item user-menu-logout"
              role="menuitem"
              onClick={() => { localStorage.removeItem('tbs_token'); window.location.reload(); }}
            >
              <LogOut size={16} />
              Keluar
            </button>
          </div>
        </Portal>
      )}
    </div>
  );
}
