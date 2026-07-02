import type { SubscriptionTier } from '../types';

const colors: Record<string, string> = {
  demo: 'badge-gray',
  pro: 'badge-amber',
  unlimited: 'badge-green',
  active: 'badge-green',
  inactive: 'badge-gray',
  menipis: 'badge-amber',
  habis: 'badge-red',
  aman: 'badge-green',
  lunas: 'badge-green',
  belum: 'badge-amber',
  overdue: 'badge-red',
};

interface BadgeProps {
  variant?: string;
  children: string;
}

export function Badge({ variant, children }: BadgeProps) {
  const cls = colors[variant || children.toLowerCase()] || 'badge-gray';
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function statusLabel(status: SubscriptionTier): string {
  const labels: Record<SubscriptionTier, string> = {
    demo: 'Demo',
    pro: 'Pro',
    unlimited: 'Unlimited',
  };
  return labels[status] || status;
}
