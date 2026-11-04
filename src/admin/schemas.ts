import { z } from 'zod';
import { PRODUCT_STATUSES, type ProductStatus } from '@/types/domain';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
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

export const variantRowSchema = z.object({
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
