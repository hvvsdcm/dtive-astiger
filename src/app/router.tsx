import { createBrowserRouter, type RouteObject } from 'react-router';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { catalogRoutes } from '@/features/catalog/routes';
import { accountRoutes } from '@/features/account/routes';
import { authRoutes } from '@/features/auth/routes';
import { checkoutRoutes } from '@/features/checkout/routes';
import { contentRoutes } from '@/features/content/routes';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';
import { requireAdmin } from './guards';

/**
 * Store routes render inside StoreLayout (header + footer). Each feature exports its routes and
 * they are listed here; set `handle: { headerOverlay: true }` (StoreRouteHandle) for a transparent
 * header. The admin area gets its own lazy top-level route next to the store layout.
 */
const storeRoutes: RouteObject[] = [
  ...catalogRoutes,
  ...authRoutes,
  ...accountRoutes,
  ...checkoutRoutes,
  ...contentRoutes,
  { path: '*', element: <NotFoundPage /> },
];

/** /admin/* pages, each in its own lazy chunk so the store bundle carries no admin code. */
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
  {
    path: 'orders',
    lazy: async () => ({ Component: (await import('@/admin/pages/OrdersPage')).OrdersPage }),
  },
  {
    path: 'orders/:id',
    lazy: async () => ({
      Component: (await import('@/admin/pages/OrderDetailPage')).OrderDetailPage,
    }),
  },
  {
    path: 'customers',
    lazy: async () => ({
      Component: (await import('@/admin/pages/CustomersPage')).CustomersPage,
    }),
  },
  {
    path: 'home',
    lazy: async () => ({
      Component: (await import('@/admin/pages/HomeSectionsPage')).HomeSectionsPage,
    }),
  },
  {
    path: 'settings',
    lazy: async () => ({ Component: (await import('@/admin/pages/SettingsPage')).SettingsPage }),
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
