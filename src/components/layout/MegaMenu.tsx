import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { cn } from '@/components/ui/cn';
import { StorageImage } from '@/features/catalog/components/StorageImage';
import type { CatalogNavItem } from '@/features/catalog/hooks';
import { isLatinLabel } from '@/features/catalog/model';

const OPEN_DELAY = 150;
const CLOSE_DELAY = 200;

export type MegaMenuProps = {
  nav: CatalogNavItem[];
  /** Lets the header drop its transparent style while a panel is open. */
  onOpenChange?: (open: boolean) => void;
};

/**
 * Desktop first-level menu. Items with children open a full-width panel (sub-categories + the
 * category photo) on hover or keyboard focus after 150ms; Esc closes it and returns focus.
 */
export function MegaMenu({ nav, onOpenChange }: MegaMenuProps) {
  const [openHref, setOpenHref] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const baseId = useId();

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function schedule(href: string | null, delay: number) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setOpenHref(href);
      onOpenChange?.(href !== null);
    }, delay);
  }

  function closeNow() {
    window.clearTimeout(timerRef.current);
    setOpenHref(null);
    onOpenChange?.(false);
  }

  return (
    <nav aria-label="주 메뉴" className="hidden lg:block">
      <ul className="flex items-center gap-6">
        {nav.map((item, index) => {
          const hasPanel = Boolean(item.children?.length);
          const open = hasPanel && openHref === item.href;
          const panelId = `${baseId}-${index}`;
          return (
            <li
              key={item.href}
              onMouseEnter={() => schedule(hasPanel ? item.href : null, OPEN_DELAY)}
              onMouseLeave={() => schedule(null, CLOSE_DELAY)}
              onFocus={() => schedule(hasPanel ? item.href : null, OPEN_DELAY)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) schedule(null, 0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && open) {
                  event.stopPropagation();
                  closeNow();
                  event.currentTarget.querySelector<HTMLElement>('a')?.focus();
                }
              }}
            >
              <NavLink
                to={item.href}
                aria-expanded={hasPanel ? open : undefined}
                aria-controls={hasPanel ? panelId : undefined}
                onClick={closeNow}
                className={({ isActive }) =>
                  cn(
                    'text-sm underline-offset-4 hover:underline',
                    isLatinLabel(item.label) && 'label-caps',
                    (isActive || open) && 'underline',
                  )
                }
              >
                {item.label}
              </NavLink>

              {open && item.children ? (
                <div
                  id={panelId}
                  className="absolute inset-x-0 top-full z-41 border-b border-line bg-bg text-ink"
                >
                  <div className="flex gap-16 px-gutter py-10">
                    <ul className="flex min-w-48 flex-col">
                      <li>
                        <Link to={item.href} onClick={closeNow} className={panelLink}>
                          전체
                        </Link>
                      </li>
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link to={child.href} onClick={closeNow} className={panelLink}>
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {item.imagePath ? (
                      <StorageImage
                        path={item.imagePath}
                        alt=""
                        sizes="240px"
                        className="ml-auto aspect-[3/4] w-60"
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const panelLink = 'flex h-8 items-center text-sm underline-offset-4 hover:underline';
