import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  ref?: Ref<HTMLInputElement>;
  label: ReactNode;
  invalid?: boolean;
};

/** 16px square box; checked = ink fill with a white check. */
export function Checkbox({ label, invalid, className, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn('inline-flex cursor-pointer items-start gap-2 text-sm', className)}
    >
      <span className="relative mt-0.5 inline-flex size-4 shrink-0">
        <input
          id={id}
          type="checkbox"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid && id ? `${id}-error` : undefined}
          className={cn(
            'peer size-4 cursor-pointer border bg-white transition-colors checked:border-ink checked:bg-ink disabled:cursor-default disabled:opacity-40',
            invalid ? 'border-danger' : 'border-field',
          )}
          {...props}
        />
        <Icon
          icon={Check}
          size={12}
          strokeWidth={2}
          className="pointer-events-none absolute inset-0.5 hidden text-white peer-checked:block"
        />
      </span>
      <span>{label}</span>
    </label>
  );
}
