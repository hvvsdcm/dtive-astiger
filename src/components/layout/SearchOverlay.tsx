import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { fetchProducts } from '@/features/catalog/api';
import { StorageImage } from '@/features/catalog/components/StorageImage';
import { searchTerm } from '@/features/catalog/model';
import { formatKRW } from '@/lib/format';
import { qk } from '@/lib/queryKeys';

const PREVIEW_COUNT = 4;

/** Top sheet (full screen on mobile) with a search field and the first matches as you type. */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => setTerm(searchTerm(value)), 250);
    return () => window.clearTimeout(id);
  }, [value]);

  const preview = useQuery({
    queryKey: qk.products({ q: term, preview: true }),
    queryFn: () => fetchProducts({ q: term }, 0),
    enabled: open && term !== '',
  });

  function close() {
    setValue('');
    setTerm('');
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-label="검색"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-x-0 top-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-bg p-0 text-ink backdrop:bg-overlay lg:h-auto"
    >
      <div className="px-gutter pb-10">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const q = value.trim();
            if (!q) return;
            close();
            void navigate(`/search?q=${encodeURIComponent(q)}`);
          }}
          className="flex h-header items-center gap-2 border-b border-ink lg:h-header-lg"
        >
          <Icon icon={Search} />
          <label htmlFor="search-overlay-q" className="sr-only">
            검색어
          </label>
          <input
            id="search-overlay-q"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={50}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus
            placeholder="검색"
            className="h-full min-w-0 flex-1 bg-transparent text-md outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {preview.isFetching ? <Spinner size={16} /> : null}
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="-mr-2 inline-flex size-10 items-center justify-center"
          >
            <Icon icon={X} />
          </button>
        </form>

        {term && preview.data ? (
          preview.data.items.length === 0 ? (
            <p className="pt-8 text-sm">'{value.trim()}'에 대한 결과가 없습니다</p>
          ) : (
            <div className="pt-6">
              <ul className="grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-4">
                {preview.data.items.slice(0, PREVIEW_COUNT).map((product) => (
                  <li key={product.id}>
                    <Link to={`/products/${product.slug}`} onClick={close} className="block">
                      <StorageImage
                        path={product.images[0]?.path ?? null}
                        alt={product.name}
                        sizes="(min-width: 768px) 25vw, 50vw"
                        className="aspect-[3/4] w-full"
                      />
                      <p className="truncate pt-2 text-sm">{product.name}</p>
                      <p className="text-sm">{formatKRW(product.price)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
              {preview.data.total > PREVIEW_COUNT ? (
                <Link
                  to={`/search?q=${encodeURIComponent(value.trim())}`}
                  onClick={close}
                  className="mt-8 inline-block text-sm underline underline-offset-4 hover:text-ink-muted"
                >
                  {`전체 보기 ${preview.data.total}`}
                </Link>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </dialog>
  );
}
