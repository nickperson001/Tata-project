import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  padding?: string;
}

export function SectionCard({ title, subtitle, children, action, className, padding = '1.25rem' }: SectionCardProps) {
  return (
    <div
      className={`card ${className || ''}`}
      style={{ padding, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            {title && (
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
