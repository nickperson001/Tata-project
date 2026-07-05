import type { ReactNode } from 'react';

interface PageSectionProps {
  children: ReactNode;
  columns?: number;
  gap?: string;
  className?: string;
}

export function PageSection({ children, columns, gap = '1.25rem', className }: PageSectionProps) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: columns ? `repeat(${columns}, 1fr)` : undefined,
        gap,
      }}
    >
      {children}
    </div>
  );
}
