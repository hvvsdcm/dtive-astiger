import { cn } from '@/components/ui/cn';
import { imageUrl } from '@/lib/images';

export type StorageImageProps = {
  /** "<bucket>/<owner>/<uuid>.webp"; null renders an empty bg-surface box. */
  path: string | null;
  alt: string;
  /** `sizes` attribute for the 800w/2000w srcset. */
  sizes: string;
  /** Above-the-fold image: no lazy loading. `priority` also raises fetch priority (hero only). */
  eager?: boolean;
  priority?: boolean;
  className?: string;
};

/** Stored product/banner photo with its 800px and 2000px renditions. */
export function StorageImage({
  path,
  alt,
  sizes,
  eager = false,
  priority = false,
  className,
}: StorageImageProps) {
  if (!path) return <div aria-hidden="true" className={cn('bg-surface', className)} />;
  const medium = imageUrl(path, 'm');
  return (
    <img
      src={medium}
      srcSet={`${medium} 800w, ${imageUrl(path, 'l')} 2000w`}
      sizes={sizes}
      alt={alt}
      loading={eager || priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cn('bg-surface object-cover', className)}
    />
  );
}
