import { LoaderCircle } from 'lucide-react';
import { cn } from './cn';
import { Icon } from './Icon';

export function Spinner({
  size = 16,
  className,
  label,
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex', className)}>
      <Icon icon={LoaderCircle} size={size} className="animate-spin" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
