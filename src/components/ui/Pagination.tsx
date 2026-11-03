import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { Icon } from './Icon';

/** Page numbers around the current page, with first/last and gaps. Pages are 1-based. */
function pageWindow(page: number, pageCount: number): Array<number | `gap-${number}`> {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => {
    const previous = sorted[i - 1];
    return previous !== undefined && p - previous > 1 ? [`gap-${p}` as const, p] : [p];
  });
}

export function Pagination({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const arrow = 'inline-flex size-9 items-center justify-center disabled:opacity-40';
  return (
    <nav aria-label="페이지" className={cn('flex items-center justify-center gap-1', className)}>
      <button
        type="button"
        className={arrow}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="이전 페이지"
      >
        <Icon icon={ChevronLeft} size={16} />
      </button>
      {pageWindow(page, pageCount).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-sm text-ink-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'inline-flex size-9 items-center justify-center text-sm',
              p === page ? 'underline underline-offset-4' : 'text-ink-muted hover:text-ink',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={arrow}
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="다음 페이지"
      >
        <Icon icon={ChevronRight} size={16} />
      </button>
    </nav>
  );
}
