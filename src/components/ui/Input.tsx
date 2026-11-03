import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from './cn';
import { controlBorder, controlClass } from './fieldStyles';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  invalid?: boolean;
};

export function Input({ invalid, className, id, type = 'text', ...props }: InputProps) {
  return (
    <input
      id={id}
      type={type}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-error` : undefined}
      className={cn(controlClass, controlBorder(invalid), 'h-11', className)}
      {...props}
    />
  );
}
