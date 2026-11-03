import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { controlBorder, controlClass } from './fieldStyles';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
  invalid?: boolean;
};

export function Textarea({ invalid, className, id, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      id={id}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-error` : undefined}
      className={cn(controlClass, controlBorder(invalid), 'resize-y py-3', className)}
      {...props}
    />
  );
}
