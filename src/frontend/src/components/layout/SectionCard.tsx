import type { CSSProperties, ReactNode } from 'react';

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
      className={['card', 'section-card', className].filter(Boolean).join(' ')}
      style={{ '--section-card-padding': padding } as CSSProperties}
    >
      {(title || action) && (
        <div className="section-card__header">
          <div className="section-card__heading">
            {title && (
              <h2 className="section-card__title">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="section-card__subtitle">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="section-card__action">{action}</div>}
        </div>
      )}
      <div className="section-card__body">{children}</div>
    </div>
  );
}
