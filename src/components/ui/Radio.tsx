import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from './cn';

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  ref?: Ref<HTMLInputElement>;
  label: ReactNode;
};

/** Square radio: 16px box, checked shows an 8px ink square. */
export function Radio({ label, className, id, ...props }: RadioProps) {
  return (
    <label
      htmlFor={id}
      className={cn('inline-flex cursor-pointer items-start gap-2 text-sm', className)}
    >
      <span className="relative mt-0.5 inline-flex size-4 shrink-0">
        <input
          id={id}
          type="radio"
          className="peer size-4 cursor-pointer border border-field bg-white transition-colors checked:border-ink disabled:cursor-default disabled:opacity-40"
          {...props}
        />
        <span className="pointer-events-none absolute inset-1 hidden bg-ink peer-checked:block" />
      </span>
      <span>{label}</span>
    </label>
  );
}
