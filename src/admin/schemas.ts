import { z } from 'zod';
import { isInternalHref } from '@/lib/internalHref';
import { PRODUCT_STATUSES, type ProductStatus } from '@/types/domain';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slugSchema = z
  .string()
  .trim()
  .min(1, '슬러그를 입력하세요')
  .max(80, '80자 이내로 입력하세요')
  .regex(SLUG_PATTERN, '영문 소문자, 숫자, 하이픈만 쓸 수 있습니다');

/** Latin letters and digits of `text` as a slug ("Wool Coat 02" → "wool-coat-02"); '' if none. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** Slug for a new record: from the name's latin part, or `prefix-xxxxxx` for names without one. */
export function suggestSlug(name: string, prefix: string): string {
  return slugify(name) || `${prefix}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Whole won amount typed into a text/number input ('' allowed only where noted). */
const wonSchema = z
  .string()
  .trim()
  .regex(/^\d{1,9}$/, '0 이상의 정수로 입력하세요')
  .transform(Number);

export const productSchema = z
  .object({
    name: z.string().trim().min(1, '상품명을 입력하세요').max(100, '100자 이내로 입력하세요'),
    slug: slugSchema,
    categoryId: z.string(),
    price: wonSchema,
    compareAtPrice: z.union([z.literal('').transform(() => null), wonSchema]),
    description: z.string().trim().max(5000, '5,000자 이내로 입력하세요'),
    material: z.string().trim().max(2000, '2,000자 이내로 입력하세요'),
    care: z.string().trim().max(2000, '2,000자 이내로 입력하세요'),
    status: z.enum(PRODUCT_STATUSES as [ProductStatus, ...ProductStatus[]]),
    isFeatured: z.boolean(),
  })
  .refine((v) => v.compareAtPrice === null || v.compareAtPrice > v.price, {
    path: ['compareAtPrice'],
    message: '정가는 판매가보다 커야 합니다',
  })
  .transform(({ categoryId, ...rest }) => ({ ...rest, categoryId: categoryId || null }));

export type ProductFormInput = z.input<typeof productSchema>;
export type ProductValues = z.output<typeof productSchema>;

const variantRowSchema = z.object({
  id: z.string(),
  color: z.string().trim().max(30, '30자 이내'),
  size: z.string().trim().max(20, '20자 이내'),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU를 입력하세요')
    .max(64, '64자 이내')
    .regex(/^[A-Za-z0-9_-]+$/, '영문, 숫자, -, _만'),
  stock: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, '0 이상 정수')
    .transform(Number),
  priceDelta: z
    .string()
    .trim()
    .regex(/^-?\d{1,9}$/, '정수로 입력')
    .transform(Number),
  isActive: z.boolean(),
});

export type VariantRowInput = z.input<typeof variantRowSchema>;
export type VariantRowValues = z.output<typeof variantRowSchema>;

/** Validates every row; errors are keyed `${rowIndex}.${field}`. SKUs must be unique in the list. */
export function validateVariantRows(
  rows: VariantRowInput[],
): { ok: true; rows: VariantRowValues[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const parsed: VariantRowValues[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const result = variantRowSchema.safeParse(row);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors[`${index}.${String(issue.path[0])}`] ??= issue.message;
      }
      return;
    }
    const sku = result.data.sku.toUpperCase();
    if (seen.has(sku)) errors[`${index}.sku`] = 'SKU 중복';
    seen.add(sku);
    parsed.push(result.data);
  });
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, rows: parsed };
}

/** Code part of a SKU from free text: latin letters/digits, upper case ("Light Grey" → "LIGHTGREY"). */
function skuPart(text: string, fallback: string): string {
  const code = text
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return code || fallback;
}

/**
 * Default SKU for a colour/size combination: "<SLUG>-<COLOR>-<SIZE>". The product slug is unique,
 * so generated SKUs do not collide across products. Non-latin colours fall back to C<n>.
 */
export function defaultSku(
  slug: string,
  color: string,
  size: string,
  colorIndex: number,
  sizeIndex: number,
): string {
  return [
    slug
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 40)
      .replace(/^-+|-+$/g, '') || 'SKU',
    color ? skuPart(color, `C${colorIndex + 1}`).slice(0, 10) : '',
    size ? skuPart(size, `S${sizeIndex + 1}`).slice(0, 10) : '',
  ]
    .filter(Boolean)
    .join('-');
}

/** Variant editor state: colour and size lists plus one row per combination. */
export type VariantGridValue = { colors: string[]; sizes: string[]; rows: VariantRowInput[] };

/** Colour and size lists as stored on existing rows, in row order. */
export function optionsFromRows(rows: Pick<VariantRowInput, 'color' | 'size'>[]): {
  colors: string[];
  sizes: string[];
} {
  return {
    colors: [...new Set(rows.map((row) => row.color).filter(Boolean))],
    sizes: [...new Set(rows.map((row) => row.size).filter(Boolean))],
  };
}

/**
 * Rows for every colour × size combination (a missing list counts as one empty value). Rows that
 * already exist keep their id, SKU, stock and price; new ones get a default SKU.
 */
export function buildRows(
  colors: string[],
  sizes: string[],
  previous: VariantRowInput[],
  skuBase: string,
): VariantRowInput[] {
  const colorList = colors.length > 0 ? colors : [''];
  const sizeList = sizes.length > 0 ? sizes : [''];
  return colorList.flatMap((color, colorIndex) =>
    sizeList.map(
      (size, sizeIndex) =>
        previous.find((row) => row.color === color && row.size === size) ?? {
          id: crypto.randomUUID(),
          color,
          size,
          sku: defaultSku(skuBase, color, size, colorIndex, sizeIndex),
          stock: '0',
          priceDelta: '0',
          isActive: true,
        },
    ),
  );
}

export const categorySchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요').max(40, '40자 이내로 입력하세요'),
  slug: slugSchema,
  parentId: z.string(),
  isActive: z.boolean(),
});

export type CategoryFormInput = z.input<typeof categorySchema>;
export type CategoryValues = z.output<typeof categorySchema>;

const hrefSchema = z
  .string()
  .trim()
  .max(200, '200자 이내로 입력하세요')
  .refine((v) => v === '' || isInternalHref(v), '/로 시작하는 사이트 내부 경로만 쓸 수 있습니다');

const sectionBase = {
  title: z.string().trim().max(80, '80자 이내로 입력하세요'),
  linkLabel: z.string().trim().max(30, '30자 이내로 입력하세요'),
  linkHref: hrefSchema,
};

const requiredImage = z.string('이미지를 올리세요').min(1, '이미지를 올리세요');

export const LOOKBOOK_MAX_ITEMS = 12;
export const COLLECTION_MAX_PRODUCTS = 8;

/** Home section per kind (hero/split/collection/lookbook); image paths are "banners/…" or "products/…". */
export const sectionSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('hero'), ...sectionBase, imagePath: requiredImage }),
    z.object({
      kind: z.literal('split'),
      ...sectionBase,
      imagePath: requiredImage,
      imagePath2: z.string().nullable(),
    }),
    z.object({
      kind: z.literal('collection'),
      ...sectionBase,
      categoryId: z.string(),
      productIds: z
        .array(z.uuid())
        .max(COLLECTION_MAX_PRODUCTS, `상품은 ${COLLECTION_MAX_PRODUCTS}개까지 지정할 수 있습니다`),
    }),
    z.object({
      kind: z.literal('lookbook'),
      ...sectionBase,
      items: z
        .array(
          z.object({
            imagePath: z.string().min(1),
            caption: z.string().trim().max(80, '80자 이내로 입력하세요'),
            href: hrefSchema,
          }),
        )
        .min(1, '이미지를 올리세요')
        .max(LOOKBOOK_MAX_ITEMS, `${LOOKBOOK_MAX_ITEMS}장까지 올릴 수 있습니다`),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.linkLabel !== '' && value.linkHref === '') {
      ctx.addIssue({ code: 'custom', path: ['linkHref'], message: '링크 경로를 입력하세요' });
    }
    if (value.linkLabel === '' && value.linkHref !== '') {
      ctx.addIssue({ code: 'custom', path: ['linkLabel'], message: '링크 문구를 입력하세요' });
    }
    if (value.kind === 'collection' && !value.categoryId && value.productIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: '카테고리나 상품을 지정하세요',
      });
    }
  });

export type SectionInput = z.input<typeof sectionSchema>;
export type SectionValues = z.output<typeof sectionSchema>;

/** Optional whole won amount above zero; '' means none. */
const positiveWonOrNone = z
  .string()
  .trim()
  .regex(/^(\d{1,9})?$/, '0보다 큰 정수로 입력하세요')
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || v > 0, '0보다 큰 정수로 입력하세요');

/** site_settings (single row) as edited on /admin/settings. */
export const settingsSchema = z.object({
  shippingFee: wonSchema,
  freeShippingThreshold: positiveWonOrNone,
  bankName: z.string().trim().min(1, '은행을 입력하세요').max(30, '30자 이내로 입력하세요'),
  bankAccount: z
    .string()
    .trim()
    .regex(/^[0-9-]{6,30}$/, '숫자와 하이픈 6–30자로 입력하세요'),
  bankHolder: z.string().trim().min(1, '예금주를 입력하세요').max(30, '30자 이내로 입력하세요'),
  paymentDueHours: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, '1–168 사이 정수로 입력하세요')
    .transform(Number)
    .refine((v) => v >= 1 && v <= 168, '1–168 사이 정수로 입력하세요'),
});

export type SettingsFormInput = z.input<typeof settingsSchema>;
export type SettingsValues = z.output<typeof settingsSchema>;

/** Carrier code (CARRIERS) and waybill number, same rule as admin_set_tracking. */
export const trackingSchema = z.object({
  carrier: z.string().min(1, '택배사를 선택하세요'),
  trackingNo: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{1,40}$/, '영문, 숫자, 하이픈 40자 이내로 입력하세요'),
});

export type TrackingFormInput = z.input<typeof trackingSchema>;
export type TrackingValues = z.output<typeof trackingSchema>;

/** Six-digit code from the authenticator app (spaces, as some apps show "123 456", removed). */
export const totpCodeSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, '6자리 숫자를 입력하세요')),
});

export type TotpCodeInput = z.input<typeof totpCodeSchema>;
export type TotpCodeValues = z.output<typeof totpCodeSchema>;
