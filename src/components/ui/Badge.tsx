import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'ink' | 'muted' | 'success' | 'danger';

const tones: Record<BadgeTone, string> = {
  neutral: 'border-line-strong text-ink',
  ink: 'border-ink bg-ink text-white',
  muted: 'border-line bg-surface text-ink-muted',
  success: 'border-success text-success',
  danger: 'border-danger text-danger',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center border px-2 text-xs whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
