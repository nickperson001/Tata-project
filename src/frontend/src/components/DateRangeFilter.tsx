import { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
  preset: 'today' | '7d' | '30d' | 'custom';
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presets = [
  { key: 'today' as const, label: 'Hari Ini' },
  { key: '7d' as const, label: '7 Hari' },
  { key: '30d' as const, label: '30 Hari' },
  { key: 'custom' as const, label: 'Custom' },
];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: string): { startDate: string; endDate: string } {
  const now = new Date();
  const end = formatDate(now);
  let start: string;
  switch (preset) {
    case 'today':
      start = end;
      break;
    case '7d':
      start = formatDate(new Date(now.getTime() - 7 * 86400000));
      break;
    case '30d':
      start = formatDate(new Date(now.getTime() - 30 * 86400000));
      break;
    default:
      start = end;
  }
  return { startDate: start, endDate: end };
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate || formatDate(new Date()));
  const [customEnd, setCustomEnd] = useState(value.endDate || formatDate(new Date()));
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!popupRef.current) return;
      if (popupRef.current.contains(e.target as Node)) return;
      if ((e.target as HTMLElement)?.closest?.('[data-date-input]')) return;
      setShowCustom(false);
    }
    if (showCustom) {
      const raf = requestAnimationFrame(() => document.addEventListener('click', handleClick));
      return () => { cancelAnimationFrame(raf); document.removeEventListener('click', handleClick); };
    }
    return;
  }, [showCustom]);

  function handlePreset(preset: 'today' | '7d' | '30d' | 'custom') {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const range = getPresetRange(preset);
    onChange({ startDate: range.startDate, endDate: range.endDate, preset });
  }

  function applyCustom() {
    if (customStart && customEnd) {
      onChange({ startDate: customStart, endDate: customEnd, preset: 'custom' });
      setShowCustom(false);
    }
  }

  const activePreset = value.preset;

  return (
    <div className="period-bar" style={{ position: 'relative', display: 'flex', gap: '0.25rem' }}>
      {presets.map((p) => (
        <button
          key={p.key}
          className={`period-btn ${activePreset === p.key ? 'active' : ''}`}
          onClick={() => handlePreset(p.key)}
        >
          {p.key === 'custom' && <Calendar size={14} style={{ marginRight: 4 }} />}
          {p.label}
        </button>
      ))}
      {showCustom && (
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Dari</label>
              <input className="input input-sm" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-date-input />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Sampai</label>
              <input className="input input-sm" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-date-input />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={applyCustom}>Terapkan</button>
        </div>
      )}
    </div>
  );
}
