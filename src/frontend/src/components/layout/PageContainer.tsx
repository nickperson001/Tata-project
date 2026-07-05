import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}

export function PageContainer({ children, maxWidth = '960px', className }: PageContainerProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxWidth,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}
