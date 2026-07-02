import { useState, useRef, useEffect } from 'react';
import { useAdminStore } from '../../store/adminStore';
import type { LogEntry } from '../../types';
import { Trash2 } from 'lucide-react';

export function TerminalTab() {
  const { logs } = useAdminStore();
  const [autoScroll, setAutoScroll] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  function logClass(level: string): string {
    switch (level) {
      case 'error': return '#fca5a5';
      case 'warn': return '#fcd34d';
      case 'info': return '#6ee7b7';
      default: return '#94a3b8';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Terminal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>System log real-time</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${autoScroll ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => useAdminStore.setState({ logs: [] })}>
            <Trash2 size={16} /> Bersihkan
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          background: '#0f172a', color: '#e2e8f0',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem',
          padding: '1rem', maxHeight: '70vh', overflowY: 'auto', lineHeight: 1.8,
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#475569', textAlign: 'center', padding: '2rem' }}>
            Belum ada log...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.1rem 0' }}>
              <span style={{ color: '#475569', minWidth: '1.5rem' }}>{logs.length - i}</span>
              <span style={{ color: '#64748b', minWidth: '1.8rem' }}>
                {new Date(log.timestamp).toLocaleTimeString('id-ID')}
              </span>
              <span style={{ color: logClass(log.level), minWidth: '3.5rem', fontWeight: 600 }}>
                [{log.level.toUpperCase()}]
              </span>
              <span>{log.message}</span>
              {log.memory && (
                <span style={{ color: '#475569', marginLeft: '0.5rem' }}>[{log.memory}]</span>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
