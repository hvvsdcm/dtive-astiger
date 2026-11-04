import type { RouteObject } from 'react-router';
import { settingsQuery } from '@/features/checkout/api';
import { queryClient } from '@/lib/queryClient';
import { FaqPage } from './pages/FaqPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ShippingPage } from './pages/ShippingPage';
import { TermsPage } from './pages/TermsPage';

/** Warms site_settings so fees and the payment window render with the first paint. Never throws. */
async function settingsLoader() {
  await queryClient.prefetchQuery(settingsQuery);
  return null;
}

const pageFallback = <div className="min-h-svh" />;

export const contentRoutes: RouteObject[] = [
  {
    path: 'terms',
    loader: settingsLoader,
    hydrateFallbackElement: pageFallback,
    element: <TermsPage />,
  },
  { path: 'privacy', element: <PrivacyPage /> },
  {
    path: 'faq',
    loader: settingsLoader,
    hydrateFallbackElement: pageFallback,
    element: <FaqPage />,
  },
  {
    path: 'shipping',
    loader: settingsLoader,
    hydrateFallbackElement: pageFallback,
    element: <ShippingPage />,
  },
];
