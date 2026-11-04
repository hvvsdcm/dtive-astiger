import { createBrowserRouter, type RouteObject } from 'react-router';
import type { MfaSetupData } from '@/admin/pages/MfaSetupPage';
import type { MfaVerifyData } from '@/admin/pages/MfaVerifyPage';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { catalogRoutes } from '@/features/catalog/routes';
import { accountRoutes } from '@/features/account/routes';
import { authRoutes } from '@/features/auth/routes';
import { checkoutRoutes } from '@/features/checkout/routes';
import { contentRoutes } from '@/features/content/routes';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';
import { requireAdmin, requireAdminMfaStep } from './guards';

const adminFallback = <div className="min-h-svh bg-bg" />;

/** TOTP screens for admins signed in with a password only (aal1), outside AdminLayout. */
const adminMfaRoutes: RouteObject[] = [
  {
    path: 'admin/mfa',
    loader: async (args): Promise<MfaVerifyData> => ({
      next: await requireAdminMfaStep('verify', args),
    }),
    hydrateFallbackElement: adminFallback,
    lazy: async () => ({ Component: (await import('@/admin/pages/MfaVerifyPage')).MfaVerifyPage }),
    errorElement: <RouteError />,
  },
  {
    path: 'admin/mfa/setup',
    loader: async (args): Promise<MfaSetupData> => {
      const next = await requireAdminMfaStep('enroll', args);
      // Lazy like every admin module: the store bundle carries no admin code.
      const { startTotpEnrollment } = await import('@/admin/api');
      return { next, enrollment: await startTotpEnrollment() };
    },
    // Loading again would replace the factor behind the QR code on screen.
    shouldRevalidate: () => false,
    hydrateFallbackElement: adminFallback,
    lazy: async () => ({ Component: (await import('@/admin/pages/MfaSetupPage')).MfaSetupPage }),
    errorElement: <RouteError />,
  },
];

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
    ...adminMfaRoutes,
    {
      path: 'admin',
      // UI gate only; RLS and the admin functions re-check is_admin() (TOTP-verified admin) on
      // every request.
      loader: async (args) => {
        await requireAdmin(args);
        return null;
      },
      // Re-checked on every move to another admin page, so a session that lost its TOTP step goes
      // back to the code screen; not after search changes. AdminLayout handles sign-out and
      // FORBIDDEN answers while a page is open.
      shouldRevalidate: ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname,
      hydrateFallbackElement: adminFallback,
      lazy: async () => ({ Component: (await import('@/admin/AdminLayout')).AdminLayout }),
      errorElement: <RouteError />,
      children: [{ errorElement: <RouteError />, children: adminPages }],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
