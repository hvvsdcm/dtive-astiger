import { cn } from './cn';

/** Placeholder box in bg-surface. Size it with className (e.g. "aspect-[3/4] w-full", "h-4 w-24"). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse bg-surface', className)} />;
}
