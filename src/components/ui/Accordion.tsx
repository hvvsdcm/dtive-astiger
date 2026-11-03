import { Minus, Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export type AccordionItem = { id: string; title: ReactNode; content: ReactNode };

/** Stacked disclosure rows separated by hairlines. Several rows may be open at once. */
export function Accordion({
  items,
  defaultOpen = [],
  className,
}: {
  items: AccordionItem[];
  defaultOpen?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState<string[]>(defaultOpen);
  const baseId = useId();

  return (
    <div className={cn('border-t border-line', className)}>
      {items.map((item) => {
        const expanded = open.includes(item.id);
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div key={item.id} className="border-b border-line">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() =>
                  setOpen((current) =>
                    expanded ? current.filter((id) => id !== item.id) : [...current, item.id],
                  )
                }
                className="flex h-12 w-full items-center justify-between text-left text-sm"
              >
                <span>{item.title}</span>
                <Icon icon={expanded ? Minus : Plus} size={16} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!expanded}
              className="pb-4 text-sm whitespace-pre-line text-ink"
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
