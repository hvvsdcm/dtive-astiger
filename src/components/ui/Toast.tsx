import { cn } from './cn';
import { useToastStore } from './toastStore';

/** Mount once at the app root; messages come from `toast()` in ./toastStore. */
export function Toaster() {
  const items = useToastStore((state) => state.items);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-70 flex flex-col items-center gap-2 p-4 md:items-end md:p-6"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto w-full max-w-[360px] px-4 py-3 text-sm text-white',
            'transition-[opacity,translate] duration-200 starting:translate-y-2 starting:opacity-0',
            item.tone === 'error' ? 'bg-danger' : 'bg-ink',
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
