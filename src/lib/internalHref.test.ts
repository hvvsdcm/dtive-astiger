import { describe, expect, it } from 'vitest';
import { isInternalHref } from './internalHref';

describe('isInternalHref', () => {
  it('accepts app paths only', () => {
    for (const href of ['/', '/shop/women', '/lookbook?season=aw26', '/products/a#b']) {
      expect(isInternalHref(href)).toBe(true);
    }
    for (const href of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      'javascript:alert(1)',
      ' /shop',
      '/shop women',
      'shop',
      '/a\u0000b',
      '',
    ]) {
      expect(isInternalHref(href)).toBe(false);
    }
  });
});
