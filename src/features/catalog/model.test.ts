import { describe, expect, it } from 'vitest';
import {
  buildCategoryTree,
  compareSizes,
  imagesForColor,
  isSoldOut,
  parseListParams,
  productColors,
  resolveCategory,
  searchTerm,
  type Category,
  type ProductCardData,
} from './model';

const categories: Category[] = [
  { id: 'm', slug: 'men', name: '남성', parentId: null, imagePath: null, sort: 1 },
  { id: 'w', slug: 'women', name: '여성', parentId: null, imagePath: null, sort: 0 },
  { id: 'wk', slug: 'women-knitwear', name: '니트', parentId: 'w', imagePath: null, sort: 1 },
  { id: 'wo', slug: 'women-outerwear', name: '아우터', parentId: 'w', imagePath: null, sort: 0 },
];

const product: ProductCardData = {
  id: 'p',
  slug: 'p',
  name: 'Coat',
  price: 100,
  compareAtPrice: null,
  images: [
    { path: 'b', color: 'Black', sort: 1 },
    { path: 'a', color: 'Beige', sort: 0 },
    { path: 'c', color: null, sort: 2 },
  ],
  variants: [
    { id: '1', color: 'Beige', size: 'S', stock: 0, isActive: true, priceDelta: 0 },
    { id: '2', color: 'Black', size: 'S', stock: 0, isActive: true, priceDelta: 0 },
    { id: '3', color: 'Beige', size: 'M', stock: 0, isActive: true, priceDelta: 0 },
    { id: '4', color: 'Navy', size: 'M', stock: 5, isActive: false, priceDelta: 0 },
  ],
};

describe('catalog model', () => {
  it('parses list params with a safe sort fallback', () => {
    expect(parseListParams(new URLSearchParams('size=M&color=Black&sort=price_asc'))).toEqual({
      size: 'M',
      color: 'Black',
      sort: 'price_asc',
    });
    expect(parseListParams(new URLSearchParams('sort=drop'))).toEqual({
      size: undefined,
      color: undefined,
      sort: 'new',
    });
  });

  it('strips filter syntax and wildcards from search input', () => {
    expect(searchTerm('  울,(코트)%_*  ')).toBe('울 코트');
    expect(searchTerm('a'.repeat(80))).toHaveLength(50);
    expect(searchTerm(null)).toBe('');
  });

  it('orders sizes by wear, then numbers, then text', () => {
    expect(['L', '90', 'ONE SIZE', 'XS', 'M', '85'].sort(compareSizes)).toEqual([
      'XS',
      'M',
      'L',
      '85',
      '90',
      'ONE SIZE',
    ]);
  });

  it('builds a sorted two-level tree and resolves category scopes', () => {
    const tree = buildCategoryTree(categories);
    expect(tree.map((node) => node.slug)).toEqual(['women', 'men']);
    expect(tree[0]?.children.map((c) => c.slug)).toEqual(['women-outerwear', 'women-knitwear']);
    expect(resolveCategory(categories, 'women')?.ids).toEqual(['w', 'wo', 'wk']);
    expect(resolveCategory(categories, 'women-knitwear')?.ids).toEqual(['wk']);
    expect(resolveCategory(categories, 'women-knitwear')?.root.slug).toBe('women');
    expect(resolveCategory(categories, 'nope')).toBeNull();
  });

  it('derives colours, sold-out state and colour images from active variants', () => {
    expect(productColors(product)).toEqual(['Beige', 'Black']);
    expect(isSoldOut(product)).toBe(true);
    expect(imagesForColor(product.images, 'Black').map((i) => i.path)).toEqual(['b', 'c']);
    expect(imagesForColor(product.images, 'Red').map((i) => i.path)).toEqual(['a', 'b', 'c']);
  });
});
