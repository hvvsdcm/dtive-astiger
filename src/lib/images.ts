import { env } from '@/config/env';

export type StorageBucket = 'products' | 'banners';
export type ImageSize = 'm' | 'l';

/**
 * Public URL of a stored image. `storagePath` is "<bucket>/<owner>/<uuid>.webp"; size 'm' points at
 * the 800px "_m.webp" sibling. Returns '' for a missing image so the caller renders a bg-surface box.
 */
export function imageUrl(storagePath: string | null, size: ImageSize = 'l'): string {
  if (!storagePath) return '';
  const path = size === 'm' ? storagePath.replace(/\.webp$/, '_m.webp') : storagePath;
  return `${env.supabaseUrl}/storage/v1/object/public/${path}`;
}

/** Object key (inside the bucket) for a new upload: "<ownerId>/<uuid>[_m].webp". */
export function storageKey(_bucket: StorageBucket, ownerId: string, size: ImageSize): string {
  return `${ownerId}/${crypto.randomUUID()}${size === 'm' ? '_m' : ''}.webp`;
}
