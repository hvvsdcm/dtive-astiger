import { business } from '@/config/business';
import { cn } from './cn';

/** Wordmark from src/assets/logo.svg rendered in currentColor. Set its height (e.g. "h-9"). */
export function Logo({ className }: { className?: string }) {
  return <span role="img" aria-label={business.brandName} className={cn('logo-mark', className)} />;
}
