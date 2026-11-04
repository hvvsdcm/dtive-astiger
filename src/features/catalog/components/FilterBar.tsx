import { ChevronDown, Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { cn } from '@/components/ui/cn';
import { Icon } from '@/components/ui/Icon';
import { PRODUCT_SORTS, parseListParams } from '../model';

export type FilterBarProps = {
  sizes: string[];
  colors: string[];
  /** Number of matching products; hidden while unknown. */
  total?: number;
};

/** Size / colour / sort controls bound to `?size=&color=&sort=`. */
export function FilterBar({ sizes, colors, total }: FilterBarProps) {
  const [params, setParams] = useSearchParams();
  const { size, color, sort } = parseListParams(params);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const sortId = useId();
  const activeCount = Number(Boolean(size)) + Number(Boolean(color));

  function update(key: 'size' | 'color' | 'sort', value: string | undefined) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  function reset() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('size');
        next.delete('color');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  return (
    <div className="border-b border-line">
      <div className="flex h-12 items-center justify-between gap-4 text-xs">
        <p className="text-ink-muted" aria-live="polite">
          {total !== undefined ? `${total.toLocaleString('ko-KR')}개` : ''}
        </p>
        <div className="flex items-center gap-6">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 items-center gap-1"
          >
            필터{activeCount ? ` ${activeCount}` : ''}
            <Icon icon={open ? Minus : Plus} size={14} />
          </button>
          <label htmlFor={sortId} className="sr-only">
            정렬
          </label>
          <div className="relative inline-flex items-center">
            <select
              id={sortId}
              value={sort}
              onChange={(event) =>
                update('sort', event.target.value === 'new' ? undefined : event.target.value)
              }
              className="h-10 bg-transparent pr-5 text-xs outline-offset-2"
            >
              {PRODUCT_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon icon={ChevronDown} size={14} className="pointer-events-none absolute right-0" />
          </div>
        </div>
      </div>

      <div id={panelId} hidden={!open} className="pb-6">
        <div className="flex flex-col gap-6 md:flex-row md:gap-16">
          {sizes.length ? (
            <fieldset>
              <legend className="mb-3 text-xs text-ink-muted">사이즈</legend>
              <div className="flex flex-wrap gap-2">
                {sizes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={size === value}
                    onClick={() => update('size', size === value ? undefined : value)}
                    className={cn(
                      'h-9 min-w-9 border px-2 text-xs transition-colors',
                      size === value ? 'border-ink' : 'border-line hover:border-ink',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          {colors.length ? (
            <fieldset>
              <legend className="mb-3 text-xs text-ink-muted">색상</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {colors.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={color === value}
                    onClick={() => update('color', color === value ? undefined : value)}
                    className={cn(
                      'h-9 text-xs underline-offset-4 hover:underline',
                      color === value && 'underline',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          {activeCount ? (
            <button
              type="button"
              onClick={reset}
              className="h-9 self-start text-xs text-ink-muted underline underline-offset-4 hover:text-ink md:self-end"
            >
              초기화
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
