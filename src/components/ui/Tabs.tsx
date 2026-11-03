import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export type TabItem<T extends string> = { value: T; label: ReactNode };

/** Underlined tab row (filters, admin order tabs). Arrow keys move between tabs. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.value === value);
    const last = items.length - 1;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight'
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
    const target = items[next];
    if (!target) return;
    onChange(target.value);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex gap-6 overflow-x-auto border-b border-line', className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px h-11 shrink-0 border-b text-sm whitespace-nowrap transition-colors',
              selected ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
