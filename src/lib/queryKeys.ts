/** React Query keys. Prefix-invalidate with the array heads, e.g. `['admin', 'orders']`. */
export const qk = {
  categories: ['categories'] as const,
  products: (filters: object = {}) => ['products', filters] as const,
  product: (slug: string) => ['product', slug] as const,
  homeSections: ['homeSections'] as const,
  settings: ['settings'] as const,
  wishlist: (userId: string | undefined) => ['wishlist', userId] as const,
  orders: (userId: string | undefined) => ['orders', userId] as const,
  order: (id: string) => ['order', id] as const,
  addresses: (userId: string | undefined) => ['addresses', userId] as const,
  profile: (userId: string | undefined) => ['profile', userId] as const,
  admin: {
    products: (filters: object = {}) => ['admin', 'products', filters] as const,
    product: (id: string) => ['admin', 'product', id] as const,
    orders: (filters: object = {}) => ['admin', 'orders', filters] as const,
    order: (id: string) => ['admin', 'order', id] as const,
    customers: (q = '') => ['admin', 'customers', q] as const,
    sections: ['admin', 'sections'] as const,
    stats: ['admin', 'stats'] as const,
    audit: ['admin', 'audit'] as const,
  },
} as const;
