import type { PaginationMeta } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  meta: PaginationMeta;
  onPage: (page: number) => void;
}

export function Pagination({ meta, onPage }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ padding: '0.75rem 0' }}>
      <span className="text-sm text-muted" aria-live="polite">
        Hal {meta.page} dari {meta.totalPages} ({meta.total} total)
      </span>
      <div className="flex gap-2" role="navigation" aria-label="Navigasi halaman">
        <button
          className="btn btn-secondary btn-sm"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={16} /> Sebelumnya
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Halaman selanjutnya"
        >
          Selanjutnya <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
