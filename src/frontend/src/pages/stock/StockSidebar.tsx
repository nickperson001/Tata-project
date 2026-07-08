import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, BookOpen, TrendingUp,
  Package, ArrowUpDown, ClipboardCheck, History, CreditCard, DollarSign,
  BarChart3, ChevronLeft, ChevronRight, Database,
  Bell, HelpCircle, Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStockStore } from '../../store/stockStore';

export interface NavLeaf {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

const topItems: NavLeaf[] = [
  { to: '/stock', label: 'Dashboard', icon: LayoutDashboard },
];

export function getNavGroups(status?: string): NavGroup[] {
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
        { to: '/stock/categories', label: 'Kategori', icon: Package },
        { to: '/stock/movement', label: 'Masuk/Keluar', icon: ArrowUpDown },
        { to: '/stock/opname', label: 'Opname', icon: ClipboardCheck },
        { to: '/stock/transfer', label: 'Transfer Gudang', icon: ArrowUpDown },
        { to: '/stock/retur', label: 'Retur Jual', icon: Undo2 },
        { to: '/stock/retur-beli', label: 'Retur Beli', icon: Undo2 },
        { to: '/stock/history', label: 'Riwayat', icon: History },
        { to: '/stock/product-stats', label: 'Analisa Produk', icon: TrendingUp },
      ],
    },
    {
      label: 'Piutang & Hutang', icon: CreditCard,
      children: [
        { to: '/stock/piutang', label: 'Piutang', icon: DollarSign },
        { to: '/stock/hutang', label: 'Hutang', icon: CreditCard },
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
  if (status === 'demo') {
    // Demo: only show Inventori group
    return [allGroups[1]];
  }
  return allGroups;
}

// Default for backward compatibility
export const navGroups = getNavGroups();

export function isActive(pathname: string, to: string) {
  if (to === '/stock') return pathname === '/stock';
  const segs = pathname.split('/');
  const tSegs = to.split('/');
  return tSegs.every((s, i) => segs[i] === s);
}

function findActiveGroup(pathname: string, groups: NavGroup[]) {
  for (const g of groups)
    if (g.children.some(c => isActive(pathname, c.to))) return g.label;
  return null;
}

export function StockSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const user = useStockStore(s => s.user);
  const groups = getNavGroups(user?.status);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => findActiveGroup(location.pathname, groups));

  return (
    <aside className={`stock-sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className="sidebar-header">
        {!collapsed && <img src="/stock/logo.svg" alt="Tata" className="sidebar-brand" style={{ height: 32 }} />}
        <button className="sidebar-collapse-btn" onClick={onToggle}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {topItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/stock'}
            className={`sidebar-item ${isActive(location.pathname, item.to) ? 'active' : ''}`}
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        <div className="sidebar-divider" />

        {groups.map(group => {
          const open = expandedGroup === group.label;
          const anyActive = group.children.some(c => isActive(location.pathname, c.to));
          return (
            <div key={group.label} className="sidebar-group">
              <button
                className={`sidebar-group-btn ${anyActive ? 'active' : ''}`}
                onClick={() => setExpandedGroup(open ? null : group.label)}
              >
                <group.icon size={20} />
                {!collapsed && <span>{group.label}</span>}
                {!collapsed && (
                  <ChevronRight size={14} className={`sg-chevron ${open ? 'open' : ''}`} />
                )}
              </button>
              {open && !collapsed && (
                <div className="sidebar-children">
                  {group.children.map(child => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.to === '/stock'}
                      className={`sidebar-child ${isActive(location.pathname, child.to) ? 'active' : ''}`}
                    >
                      <child.icon size={16} />
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
