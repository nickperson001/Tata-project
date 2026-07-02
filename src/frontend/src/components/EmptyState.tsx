import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="card card-p empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-text">{text}</div>
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
}
