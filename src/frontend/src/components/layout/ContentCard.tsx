import type { ReactNode } from 'react';

interface ContentCardProps {
  children: ReactNode;
  className?: string;
  padding?: string;
}

export function ContentCard({ children, className, padding = '1.5rem' }: ContentCardProps) {
  return (
    <div
      className={`card ${className || ''}`}
      style={{ padding }}
    >
      {children}
    </div>
  );
}
