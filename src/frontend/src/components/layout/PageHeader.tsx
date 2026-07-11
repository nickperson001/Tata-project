import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={['page-header', className].filter(Boolean).join(' ')}>
      <div className="page-header__body">
        <h1 className="page-header__title">
          {title}
        </h1>
        {subtitle && (
          <p className="page-header__subtitle">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="page-header__actions">
          {actions}
        </div>
      )}
    </div>
  );
}
