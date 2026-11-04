import { useState } from 'react';
import { StorageImage } from './StorageImage';

export type GalleryImage = { path: string; alt: string };

/**
 * PDP photos: a vertical stack from 1024px, a horizontal scroll-snap strip with an "n/total"
 * counter below that. No images → one empty 3:4 box.
 */
export function ImageGallery({ images, label }: { images: GalleryImage[]; label: string }) {
  const [index, setIndex] = useState(0);

  if (!images.length) {
    return <div aria-hidden="true" className="aspect-[3/4] w-full bg-surface" />;
  }

  return (
    <div className="relative">
      <ul
        aria-label={label}
        tabIndex={0}
        onScroll={(event) => {
          const strip = event.currentTarget;
          if (strip.clientWidth) setIndex(Math.round(strip.scrollLeft / strip.clientWidth));
        }}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto lg:flex-col lg:gap-2 lg:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, i) => (
          <li key={image.path} className="w-full shrink-0 snap-start">
            <StorageImage
              path={image.path}
              alt={image.alt}
              sizes="(min-width: 1024px) 60vw, 100vw"
              eager={i === 0}
              className="aspect-[3/4] w-full"
            />
          </li>
        ))}
      </ul>
      {images.length > 1 ? (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-3 text-xs text-ink tabular-nums lg:hidden"
        >
          {Math.min(index, images.length - 1) + 1}/{images.length}
        </p>
      ) : null}
    </div>
  );
}
