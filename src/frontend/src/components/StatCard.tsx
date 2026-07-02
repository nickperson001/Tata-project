import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div className={`card card-p stat ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
        {icon && <div style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{icon}</div>}
      </div>
    </div>
  );
}
