import { createBrowserRouter, type RouteObject } from 'react-router';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { catalogRoutes } from '@/features/catalog/routes';
import { accountRoutes } from '@/features/account/routes';
import { authRoutes } from '@/features/auth/routes';
import { checkoutRoutes } from '@/features/checkout/routes';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';
import { requireAdmin } from './guards';

/**
 * Store routes render inside StoreLayout (header + footer). Feature slices add their routes to
 * this list; set `handle: { headerOverlay: true }` (StoreRouteHandle) for a transparent header.
 * The admin area gets its own lazy top-level route next to the store layout.
 */
const storeRoutes: RouteObject[] = [
  // catalog (S4) · auth/account (S3) · cart/checkout/orders (S5) · content pages (S8)
  ...catalogRoutes,
  ...authRoutes,
  ...accountRoutes,
  ...checkoutRoutes,
  { path: '*', element: <NotFoundPage /> },
];

/**
 * /admin/* pages, each in its own lazy chunk so the store bundle carries no admin code. Admin
 * slices (S6 products/categories, S7 orders/customers/home/settings) add their pages here.
 */
const adminPages: RouteObject[] = [
  {
    index: true,
    lazy: async () => ({ Component: (await import('@/admin/pages/DashboardPage')).DashboardPage }),
  },
  {
    path: 'products',
    lazy: async () => ({ Component: (await import('@/admin/pages/ProductsPage')).ProductsPage }),
  },
  {
    path: 'products/new',
    lazy: async () => ({
      Component: (await import('@/admin/pages/ProductEditPage')).ProductEditPage,
    }),
  },
  {
    path: 'products/:id',
    lazy: async () => ({
      Component: (await import('@/admin/pages/ProductEditPage')).ProductEditPage,
    }),
  },
  {
    path: 'categories',
    lazy: async () => ({
      Component: (await import('@/admin/pages/CategoriesPage')).CategoriesPage,
    }),
  },
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(
  [
    {
      element: <StoreLayout />,
      errorElement: <RouteError />,
      children: [{ errorElement: <RouteError />, children: storeRoutes }],
    },
    {
      path: 'admin',
      // UI gate only; RLS and the admin functions re-check is_admin() on every request.
      loader: async (args) => {
        await requireAdmin(args);
        return null;
      },
      // Checked on entry; AdminLayout handles sign-out while inside.
      shouldRevalidate: () => false,
      hydrateFallbackElement: <div className="min-h-svh bg-bg" />,
      lazy: async () => ({ Component: (await import('@/admin/AdminLayout')).AdminLayout }),
      errorElement: <RouteError />,
      children: [{ errorElement: <RouteError />, children: adminPages }],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
