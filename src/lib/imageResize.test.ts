import { describe, expect, it } from 'vitest';
import { fitWithin, imageFileError, MAX_SOURCE_BYTES } from './imageResize';

describe('imageFileError', () => {
  it('accepts JPEG, PNG and WebP up to the size limit', () => {
    expect(imageFileError({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(imageFileError({ type: 'image/png', size: MAX_SOURCE_BYTES })).toBeNull();
    expect(imageFileError({ type: 'image/webp', size: 1 })).toBeNull();
  });

  it('rejects other types and oversized files', () => {
    expect(imageFileError({ type: 'application/pdf', size: 1000 })).toMatch(/JPG, PNG, WEBP/);
    expect(imageFileError({ type: 'image/svg+xml', size: 1000 })).toMatch(/JPG, PNG, WEBP/);
    expect(imageFileError({ type: 'image/jpeg', size: MAX_SOURCE_BYTES + 1 })).toMatch(/10MB/);
  });
});

describe('fitWithin', () => {
  it('scales the longest side down to the limit', () => {
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(4000, 3000, 800)).toEqual({ width: 800, height: 600 });
  });

  it('never upscales', () => {
    expect(fitWithin(600, 800, 2000)).toEqual({ width: 600, height: 800 });
  });
});
