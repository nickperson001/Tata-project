import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  count?: number;
  style?: CSSProperties;
}

export function Skeleton({ width, height, className, count, style }: SkeletonProps) {
  const items = count ?? 1;
  return (
    <>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className={`skel ${className || ''}`}
          style={{ width: width || '100%', height: height || '1rem', ...style }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="tbl-wrap" aria-label="Memuat data..." role="status">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><Skeleton width="80%" height="0.75rem" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><Skeleton width={`${60 + Math.random() * 30}%`} height="0.75rem" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
