import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from './cn';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm';

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean };

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-hover',
  secondary: 'border border-ink bg-transparent text-ink hover:bg-surface',
  ghost: 'bg-transparent text-ink underline underline-offset-4 hover:text-ink-muted',
  danger: 'border border-danger bg-transparent text-danger hover:bg-surface',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-6 text-md md:text-sm',
  sm: 'h-9 px-4 text-sm',
};

function buttonClass(
  { variant = 'primary', size = 'md', fullWidth }: StyleProps,
  className?: string,
) {
  return cn(
    base,
    variants[variant],
    variant === 'ghost' ? (size === 'md' ? 'h-11 px-0 text-sm' : 'h-9 px-0 text-sm') : sizes[size],
    fullWidth && 'w-full',
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  StyleProps & {
    loading?: boolean;
    children?: ReactNode;
  };

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, fullWidth }, className)}
      {...props}
    >
      {loading ? <Spinner size={16} /> : null}
      {children}
    </button>
  );
}

export type ButtonLinkProps = LinkProps & StyleProps;

/** A router link that looks like a Button. */
export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, fullWidth }, className)} {...props} />;
}
