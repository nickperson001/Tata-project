interface SkeletonProps {
  width?: string;
  height?: string;
  count?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '1rem', count = 1, style }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skel" style={{ width, height, marginBottom: count > 1 ? '0.5rem' : 0, ...style }} />
      ))}
    </>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><div className="skel" style={{ width: '80%', height: '0.8rem' }} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><div className="skel" style={{ width: `${60 + Math.random() * 30}%`, height: '0.8rem' }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
