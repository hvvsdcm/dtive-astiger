import { ChevronDown } from 'lucide-react';
import type { Ref, SelectHTMLAttributes } from 'react';
import { cn } from './cn';
import { controlBorder, controlClass } from './fieldStyles';
import { Icon } from './Icon';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>;
  invalid?: boolean;
};

export function Select({ invalid, className, id, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && id ? `${id}-error` : undefined}
        className={cn(controlClass, controlBorder(invalid), 'h-11 pr-10')}
        {...props}
      >
        {children}
      </select>
      <Icon
        icon={ChevronDown}
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
