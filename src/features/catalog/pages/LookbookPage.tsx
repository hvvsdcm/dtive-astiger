import { pageTitle } from '@/config/site';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LookFigure } from '../components/HomeSection';
import { useHomeSections } from '../hooks';
import { isLatinLabel } from '../model';

/** Every active lookbook section, looks in two columns from 768px. */
export function LookbookPage() {
  const { data, isPending, isError, refetch } = useHomeSections();
  const books = (data ?? []).filter(
    (section) => section.kind === 'lookbook' && section.items.length,
  );

  return (
    <div className="px-gutter pt-10 pb-16 lg:pt-16 lg:pb-24">
      <title>{pageTitle('Lookbook')}</title>
      {isPending ? (
        <div aria-busy="true" className="flex flex-col gap-6">
          <Skeleton className="h-11 w-56" />
          <div className="grid gap-2 md:grid-cols-2">
            <Skeleton className="aspect-[3/4] w-full" />
            <Skeleton className="aspect-[3/4] w-full max-md:hidden" />
          </div>
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : books.length === 0 ? (
        <>
          <h1 className="font-display text-2xl">Lookbook</h1>
          <EmptyState title="준비 중입니다" action={{ label: '쇼핑하기', to: '/shop' }} />
        </>
      ) : (
        <div className="flex flex-col gap-16 lg:gap-24">
          {books.map((book, bookIndex) => {
            const title = book.title || 'Lookbook';
            const Heading = bookIndex === 0 ? 'h1' : 'h2';
            return (
              <section key={book.id} className="flex flex-col gap-6 lg:gap-10">
                <Heading className={isLatinLabel(title) ? 'font-display text-2xl' : 'text-xl'}>
                  {title}
                </Heading>
                <ul className="grid gap-x-2 gap-y-10 md:grid-cols-2">
                  {book.items.map((item, index) => (
                    <li key={item.imagePath}>
                      <LookFigure
                        item={item}
                        sizes="(min-width: 768px) 50vw, 100vw"
                        eager={bookIndex === 0 && index < 2}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
