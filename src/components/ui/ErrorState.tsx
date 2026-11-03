import { cn } from './cn';

export function ErrorState({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-4 py-24 text-center', className)}
    >
      <p className="text-base">불러오지 못했습니다</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm underline underline-offset-4 hover:text-ink-muted"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
