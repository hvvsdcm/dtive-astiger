/**
 * Client-side image preparation for admin uploads (docs/PLAN.md 2.5, ⑧-10). Every upload is
 * decoded and re-encoded through a canvas, which drops EXIF/metadata and anything that is not
 * pixels. Supabase image transformation is a paid feature, so the two renditions (2000px and 800px)
 * are produced here.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Upper bound for a source file; the encoded renditions stay well under the bucket limits. */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** Korean message for a file that must not be uploaded, or null when it is acceptable. */
export function imageFileError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'JPG, PNG, WEBP 파일만 올릴 수 있습니다';
  }
  if (file.size > MAX_SOURCE_BYTES) return '10MB 이하 파일만 올릴 수 있습니다';
  return null;
}

/** Size that fits inside a `max`×`max` box, keeping the ratio and never upscaling. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('IMAGE_ENCODE_FAILED'))),
      type,
      quality,
    );
  });
}

/**
 * Decodes `file`, scales its longest side down to `maxSize` and encodes WebP. Browsers that cannot
 * encode WebP (canvas returns PNG instead) get a JPEG; the returned Blob's `type` is the real format
 * and must be used as the upload content type.
 */
export async function imageResize(file: Blob, maxSize: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSize);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('IMAGE_ENCODE_FAILED');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    const webp = await canvasToBlob(canvas, 'image/webp', quality);
    if (webp.type === 'image/webp') return webp;
    return await canvasToBlob(canvas, 'image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
