import { createBrowserRouter, type RouteObject } from 'react-router';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { catalogRoutes } from '@/features/catalog/routes';
import { accountRoutes } from '@/features/account/routes';
import { authRoutes } from '@/features/auth/routes';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

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
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(
  [
    {
      element: <StoreLayout />,
      errorElement: <RouteError />,
      children: [{ errorElement: <RouteError />, children: storeRoutes }],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
