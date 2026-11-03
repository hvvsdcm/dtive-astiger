import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Centered modal on the native <dialog> (top layer, focus trap, Esc). Closes on Esc, the close
 * button and backdrop click.
 */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
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
        'm-auto w-[calc(100%-32px)] max-w-[480px] border-0 bg-bg p-0 text-ink backdrop:bg-overlay',
        className,
      )}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 id={titleId} className="text-md font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 inline-flex size-9 items-center justify-center"
          >
            <Icon icon={X} />
          </button>
        </div>
        <div className="px-6 py-6 text-base">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
}
