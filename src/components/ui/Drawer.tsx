import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** right: 420px panel (full width on mobile). left: full-screen panel used by the mobile menu. */
  side?: 'right' | 'left';
  className?: string;
};

/** Side panel on the native <dialog>: focus trap, Esc, backdrop click, 300ms slide. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  className,
}: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'fixed inset-y-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-bg p-0 text-ink backdrop:bg-overlay',
        'transition-[translate,display,overlay] transition-discrete duration-300 ease-panel',
        side === 'right'
          ? 'right-0 left-auto translate-x-full open:translate-x-0 sm:w-[420px] starting:open:translate-x-full'
          : 'right-auto left-0 -translate-x-full open:translate-x-0 starting:open:-translate-x-full',
        className,
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-4 lg:h-16 lg:px-6">
          <h2 id={titleId} className="text-sm font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 inline-flex size-10 items-center justify-center"
          >
            <Icon icon={X} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-line px-4 py-4 lg:px-6">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
}
