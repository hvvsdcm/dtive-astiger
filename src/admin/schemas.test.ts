import { describe, expect, it } from 'vitest';
import {
  buildRows,
  defaultSku,
  optionsFromRows,
  productSchema,
  sectionSchema,
  settingsSchema,
  slugify,
  suggestSlug,
  trackingSchema,
  validateVariantRows,
  type ProductFormInput,
  type SettingsFormInput,
  type VariantRowInput,
} from './schemas';

const product: ProductFormInput = {
  name: '울 코트',
  slug: 'wool-coat',
  categoryId: '',
  price: '189000',
  compareAtPrice: '',
  description: '',
  material: '',
  care: '',
  status: 'draft',
  isFeatured: false,
};

const row = (patch: Partial<VariantRowInput> = {}): VariantRowInput => ({
  id: 'v1',
  color: 'Black',
  size: 'S',
  sku: 'WOOL-COAT-BLACK-S',
  stock: '3',
  priceDelta: '0',
  isActive: true,
  ...patch,
});

describe('slugs', () => {
  it('keeps latin letters and digits only', () => {
    expect(slugify('Wool Coat 02')).toBe('wool-coat-02');
    expect(slugify('  --Café  Noir--')).toBe('cafe-noir');
    expect(slugify('울 코트')).toBe('');
  });

  it('falls back to a prefixed random slug for names without latin text', () => {
    expect(suggestSlug('울 코트', 'item')).toMatch(/^item-[0-9a-f]{6}$/);
    expect(suggestSlug('Linen Shirt', 'item')).toBe('linen-shirt');
  });
});

describe('productSchema', () => {
  it('parses prices and maps an empty category and compare price to null', () => {
    const result = productSchema.parse(product);
    expect(result.price).toBe(189000);
    expect(result.compareAtPrice).toBeNull();
    expect(result.categoryId).toBeNull();
  });

  it('requires the compare-at price to exceed the price', () => {
    const result = productSchema.safeParse({ ...product, compareAtPrice: '189000' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['compareAtPrice']);
  });

  it('rejects invalid slugs and non-integer prices', () => {
    expect(productSchema.safeParse({ ...product, slug: 'Wool Coat' }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, price: '-1' }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, price: '1.5' }).success).toBe(false);
  });
});

describe('variants', () => {
  it('builds one row per colour × size and keeps existing rows', () => {
    const existing = row({ stock: '7' });
    const rows = buildRows(['Black', 'Ivory'], ['S', 'M', 'L'], [existing], 'wool-coat');
    expect(rows).toHaveLength(6);
    expect(rows[0]).toBe(existing);
    expect(rows[4]).toMatchObject({ color: 'Ivory', size: 'M', sku: 'WOOL-COAT-IVORY-M' });
  });

  it('uses a single empty row when no options are set', () => {
    const rows = buildRows([], [], [], 'scarf');
    expect(rows).toEqual([expect.objectContaining({ color: '', size: '', sku: 'SCARF' })]);
  });

  it('builds SKUs with fallbacks for non-latin values', () => {
    expect(defaultSku('wool-coat', '검정', 'Free', 1, 0)).toBe('WOOL-COAT-C2-FREE');
    expect(defaultSku('', 'Light Grey', 'M', 0, 0)).toBe('SKU-LIGHTGREY-M');
  });

  it('reads colour and size lists back from rows', () => {
    expect(
      optionsFromRows([row(), row({ size: 'M' }), row({ color: 'Ivory', size: 'S' })]),
    ).toEqual({ colors: ['Black', 'Ivory'], sizes: ['S', 'M'] });
  });

  it('reports per-row errors and duplicate SKUs', () => {
    const result = validateVariantRows([
      row(),
      row({ id: 'v2', size: 'M', sku: 'wool-coat-black-s' }),
      row({ id: 'v3', size: 'L', sku: 'OK-L', stock: '-2' }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({ '1.sku': 'SKU 중복', '2.stock': '0 이상 정수' });
    }
  });

  it('returns parsed rows when valid', () => {
    const result = validateVariantRows([row({ priceDelta: '-5000' })]);
    expect(result).toEqual({
      ok: true,
      rows: [expect.objectContaining({ stock: 3, priceDelta: -5000 })],
    });
  });
});

describe('sectionSchema', () => {
  const base = { title: 'Women', linkLabel: '', linkHref: '' };

  it('requires an image for hero and split', () => {
    expect(sectionSchema.safeParse({ kind: 'hero', ...base, imagePath: '' }).success).toBe(false);
    expect(
      sectionSchema.safeParse({
        kind: 'split',
        ...base,
        imagePath: 'banners/a/b.webp',
        imagePath2: null,
      }).success,
    ).toBe(true);
  });

  it('needs both link label and path, or neither', () => {
    const result = sectionSchema.safeParse({
      kind: 'hero',
      ...base,
      linkLabel: 'Shop',
      imagePath: 'banners/a/b.webp',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['linkHref']);
  });

  it('rejects external links, also inside lookbook items', () => {
    expect(
      sectionSchema.safeParse({
        kind: 'hero',
        ...base,
        linkLabel: 'Go',
        linkHref: 'javascript:alert(1)',
        imagePath: 'banners/a/b.webp',
      }).success,
    ).toBe(false);
    const result = sectionSchema.safeParse({
      kind: 'lookbook',
      ...base,
      items: [{ imagePath: 'banners/a/b.webp', caption: 'Look 01', href: 'https://x.example' }],
    });
    expect(result.error?.issues[0]?.path).toEqual(['items', 0, 'href']);
  });

  it('needs a category or products for a collection', () => {
    expect(
      sectionSchema.safeParse({ kind: 'collection', ...base, categoryId: '', productIds: [] })
        .success,
    ).toBe(false);
    expect(
      sectionSchema.safeParse({
        kind: 'collection',
        ...base,
        categoryId: '',
        productIds: ['3522c0db-45c4-4900-862d-65019478e239'],
      }).success,
    ).toBe(true);
  });
});

describe('settingsSchema', () => {
  const settings: SettingsFormInput = {
    shippingFee: '3000',
    freeShippingThreshold: '100000',
    bankName: '국민은행',
    bankAccount: '000000-00-000000',
    bankHolder: '디티브아시티거',
    paymentDueHours: '48',
  };

  it('parses numbers and treats an empty threshold as none', () => {
    expect(settingsSchema.parse({ ...settings, freeShippingThreshold: '' })).toMatchObject({
      shippingFee: 3000,
      freeShippingThreshold: null,
      paymentDueHours: 48,
    });
  });

  it('rejects bad account numbers, a zero threshold and deadlines out of 1–168', () => {
    expect(settingsSchema.safeParse({ ...settings, bankAccount: '12 34' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, freeShippingThreshold: '0' }).success).toBe(
      false,
    );
    expect(settingsSchema.safeParse({ ...settings, paymentDueHours: '0' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, paymentDueHours: '169' }).success).toBe(false);
  });
});

describe('trackingSchema', () => {
  it('matches the server waybill rule', () => {
    expect(trackingSchema.safeParse({ carrier: 'cj', trackingNo: ' 1234-5678 ' }).data).toEqual({
      carrier: 'cj',
      trackingNo: '1234-5678',
    });
    expect(trackingSchema.safeParse({ carrier: '', trackingNo: '1' }).success).toBe(false);
    expect(trackingSchema.safeParse({ carrier: 'cj', trackingNo: '12 34' }).success).toBe(false);
  });
});
