import { cn } from '@/components/ui/cn';
import { ErrorState } from '@/components/ui/ErrorState';
import type { HomeSection as HomeSectionData } from '../api';
import { useCollection } from '../hooks';
import { isLatinLabel } from '../model';
import { ProductGrid } from './ProductGrid';
import { SectionLink } from './SectionLink';
import { StorageImage } from './StorageImage';

const linkClass = (label: string) =>
  cn(
    'text-xs underline underline-offset-4 hover:no-underline',
    isLatinLabel(label) && 'label-caps',
  );

function SectionHeading({ section }: { section: HomeSectionData }) {
  if (!section.title && !section.linkLabel) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 px-gutter">
      {section.title ? <h2 className="font-display text-xl">{section.title}</h2> : <span />}
      {section.linkLabel && section.linkHref ? (
        <SectionLink
          href={section.linkHref}
          className={cn('shrink-0', linkClass(section.linkLabel))}
        >
          {section.linkLabel}
        </SectionLink>
      ) : null}
    </div>
  );
}

/** Full-bleed photo under the transparent header, title and link bottom-left in white. */
function Hero({ section, first }: { section: HomeSectionData; first: boolean }) {
  return (
    <section className="relative h-svh min-h-[560px] w-full overflow-hidden bg-surface">
      <StorageImage
        path={section.imagePath}
        alt=""
        sizes="100vw"
        eager
        priority={first}
        className="absolute inset-0 size-full"
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-4 px-gutter pb-12 text-white lg:pb-16">
        {section.title ? <h2 className="font-display text-hero">{section.title}</h2> : null}
        {section.linkLabel && section.linkHref ? (
          <SectionLink href={section.linkHref} className={linkClass(section.linkLabel)}>
            {section.linkLabel}
          </SectionLink>
        ) : null}
      </div>
    </section>
  );
}

/** Two photos side by side (one when the second is missing), title and link underneath. */
function Split({ section }: { section: HomeSectionData }) {
  const images = [section.imagePath, section.imagePath2].filter((path): path is string =>
    Boolean(path),
  );
  const single = images.length < 2;
  const body = (
    <div className={cn('grid gap-2', !single && 'grid-cols-2')}>
      {(single ? [section.imagePath] : images).map((path) => (
        <StorageImage
          key={path ?? 'empty'}
          path={path}
          alt=""
          sizes={single ? '100vw' : '50vw'}
          className={cn('w-full', single ? 'aspect-[4/5] md:aspect-[16/9]' : 'aspect-[3/4]')}
        />
      ))}
    </div>
  );
  return (
    <section className="flex flex-col gap-6">
      <SectionLink
        href={section.linkHref}
        aria-label={section.title || section.linkLabel}
        className="block"
      >
        {body}
      </SectionLink>
      <SectionHeading section={section} />
    </section>
  );
}

/** Section title + up to 8 products (4 on mobile, 6 on tablet so rows stay full). */
function Collection({ section }: { section: HomeSectionData }) {
  const { data, isPending, isError, refetch } = useCollection(section);
  if (!isPending && !isError && data.length === 0) return null;
  const itemClassName = (index: number) =>
    index >= 6 ? 'max-xl:hidden' : index >= 4 ? 'max-md:hidden' : undefined;
  return (
    <section className="flex flex-col gap-6">
      <SectionHeading section={section} />
      <div className="px-gutter">
        {isError ? (
          <ErrorState onRetry={() => void refetch()} className="py-12" />
        ) : (
          <ProductGrid
            products={data ?? []}
            loadingCount={isPending ? 4 : 0}
            itemClassName={itemClassName}
          />
        )}
      </div>
    </section>
  );
}

/** First four looks with captions, linking to the full lookbook. */
function LookbookStrip({ section }: { section: HomeSectionData }) {
  if (!section.items.length) return null;
  return (
    <section className="flex flex-col gap-6">
      <SectionHeading section={section} />
      <ul className="grid grid-cols-2 gap-x-2 gap-y-6 px-gutter md:grid-cols-4">
        {section.items.slice(0, 4).map((item) => (
          <li key={item.imagePath}>
            <LookFigure item={item} sizes="(min-width: 768px) 25vw, 50vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LookFigure({
  item,
  sizes,
  eager = false,
}: {
  item: HomeSectionData['items'][number];
  sizes: string;
  eager?: boolean;
}) {
  const figure = (
    <figure className="flex flex-col gap-2">
      <StorageImage
        path={item.imagePath}
        alt={item.caption}
        sizes={sizes}
        eager={eager}
        className="aspect-[3/4] w-full"
      />
      {item.caption ? <figcaption className="text-xs">{item.caption}</figcaption> : null}
    </figure>
  );
  return item.href ? (
    <SectionLink href={item.href} className="block">
      {figure}
    </SectionLink>
  ) : (
    figure
  );
}

export function HomeSection({ section, first }: { section: HomeSectionData; first: boolean }) {
  switch (section.kind) {
    case 'hero':
      return <Hero section={section} first={first} />;
    case 'split':
      return <Split section={section} />;
    case 'collection':
      return <Collection section={section} />;
    case 'lookbook':
      return <LookbookStrip section={section} />;
  }
}
