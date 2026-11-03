import { Link } from 'react-router';
import { cn } from './cn';

export type EmptyStateAction =
  { label: string; to: string } | { label: string; onClick: () => void };

/** One sentence and at most one link. */
export function EmptyState({
  title,
  action,
  className,
}: {
  title: string;
  action?: EmptyStateAction;
  className?: string;
}) {
  const actionClass = 'text-sm underline underline-offset-4 hover:text-ink-muted';
  return (
    <div className={cn('flex flex-col items-center gap-4 py-24 text-center', className)}>
      <p className="text-base">{title}</p>
      {action && 'to' in action ? (
        <Link to={action.to} className={actionClass}>
          {action.label}
        </Link>
      ) : null}
      {action && 'onClick' in action ? (
        <button type="button" onClick={action.onClick} className={actionClass}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
