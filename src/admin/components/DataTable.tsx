import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Classes for both the header and body cells of this column (width, alignment). */
  className?: string;
};

/** Compact 36px control for inputs inside admin tables and tiles. */
export const denseControlClass =
  'block h-9 w-full min-w-0 border border-field bg-white px-2 text-sm text-ink transition-colors outline-none focus:border-ink aria-invalid:border-danger';

const SKELETON_ROWS = 5;

/** Admin list table: 5 skeleton rows while loading, retry on error, one line when empty. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = false,
  onRetry,
  emptyText = '결과가 없습니다',
  label,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  emptyText?: string;
  /** Accessible table caption. */
  label: string;
}) {
  return (
    <Table aria-busy={loading || undefined}>
      <caption className="sr-only">{label}</caption>
      <THead>
        <tr>
          {columns.map((column) => (
            <TH key={column.key} className={cn('relative', column.className)}>
              {column.header}
            </TH>
          ))}
        </tr>
      </THead>
      <TBody>
        {loading
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <TR key={index}>
                {columns.map((column) => (
                  <TD key={column.key} className={column.className}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TD>
                ))}
              </TR>
            ))
          : null}
        {!loading && error ? (
          <tr>
            <td colSpan={columns.length}>
              <ErrorState onRetry={onRetry} className="py-12" />
            </td>
          </tr>
        ) : null}
        {!loading && !error && rows?.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-12 text-center text-sm text-ink-muted">
              {emptyText}
            </td>
          </tr>
        ) : null}
        {!loading && !error
          ? rows?.map((row) => (
              <TR key={rowKey(row)}>
                {columns.map((column) => (
                  <TD key={column.key} className={cn('relative', column.className)}>
                    {column.cell(row)}
                  </TD>
                ))}
              </TR>
            ))
          : null}
      </TBody>
    </Table>
  );
}
