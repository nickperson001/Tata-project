import { DateRangeFilter, type DateRange } from './DateRangeFilter';
export type { DateRange };
import { Search, Filter } from 'lucide-react';

interface FilterBarProps {
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  channel?: string;
  onChannelChange?: (channel: string) => void;
  channels?: string[];
  category?: string;
  onCategoryChange?: (category: string) => void;
  categories?: { name: string; id?: string }[];
  status?: string;
  onStatusChange?: (status: string) => void;
  statusOptions?: { value: string; label: string }[];
  search?: string;
  onSearchChange?: (search: string) => void;
  showSearch?: boolean;
  showDateFilter?: boolean;
  showChannel?: boolean;
  showCategory?: boolean;
  showStatus?: boolean;
}

const defaultStatusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'lunas', label: 'Lunas' },
  { value: 'belum', label: 'Belum Lunas' },
];

export function FilterBar({
  dateRange = { startDate: null, endDate: null, preset: 'today' },
  onDateRangeChange,
  channel = '', onChannelChange,
  channels = [],
  category = '', onCategoryChange,
  categories = [],
  status = '', onStatusChange,
  statusOptions = defaultStatusOptions,
  search = '', onSearchChange,
  showSearch = true, showDateFilter = true, showChannel = false, showCategory = false, showStatus = false,
}: FilterBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      background: 'var(--card-bg)', borderRadius: 10, padding: '0.75rem 1rem',
      border: '1px solid var(--border)',
    }}>
      {showDateFilter && onDateRangeChange && (
        <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
      )}

      {showChannel && channels.length > 0 && (
        <select
          className="input input-sm"
          value={channel}
          onChange={(e) => onChannelChange?.(e.target.value)}
          style={{ width: 'auto', minWidth: 120 }}
        >
          <option value="">Semua Channel</option>
          {channels.map((ch) => (
            <option key={ch} value={ch}>{ch.charAt(0).toUpperCase() + ch.slice(1)}</option>
          ))}
        </select>
      )}

      {showCategory && categories.length > 0 && (
        <select
          className="input input-sm"
          value={category}
          onChange={(e) => onCategoryChange?.(e.target.value)}
          style={{ width: 'auto', minWidth: 120 }}
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id || c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      )}

      {showStatus && (
        <select
          className="input input-sm"
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
          style={{ width: 'auto', minWidth: 120 }}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {showSearch && (
        <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 260 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input input-sm"
            placeholder="Cari..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            style={{ paddingLeft: '1.75rem', width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
