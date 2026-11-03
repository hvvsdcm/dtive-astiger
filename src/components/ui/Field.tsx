import type { ReactNode } from 'react';
import { cn } from './cn';

export type FieldProps = {
  /** id of the control inside; the error gets `${id}-error` for aria-describedby. */
  id: string;
  label: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label above, control, error text below. Controls given the same id and `invalid` point aria-describedby at the error. */
export function Field({ id, label, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-xs text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-ink-muted">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
