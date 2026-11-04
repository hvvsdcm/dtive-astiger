import type { RouteObject } from 'react-router';
import type { StoreRouteHandle } from '@/components/layout/StoreLayout';
import { queryClient } from '@/lib/queryClient';
import { homeSectionsQuery } from './hooks';
import { CategoryPage } from './pages/CategoryPage';
import { HomePage } from './pages/HomePage';
import { LookbookPage } from './pages/LookbookPage';
import { ProductPage } from './pages/ProductPage';
import { SearchPage } from './pages/SearchPage';

/**
 * The home header is transparent only when the first active section is a hero. The loader fills
 * the cache before the route renders, so the layout reads the answer on that render; while the
 * very first load is pending the header stays transparent (the hero is the common case).
 */
const homeHandle: StoreRouteHandle = {
  get headerOverlay() {
    const state = queryClient.getQueryState(homeSectionsQuery.queryKey);
    if (!state || state.status === 'pending') return true;
    return state.data?.[0]?.kind === 'hero';
  },
};

async function homeLoader() {
  try {
    await queryClient.ensureQueryData(homeSectionsQuery);
  } catch {
    // HomePage shows the error state and retries through React Query.
  }
  return null;
}

export const catalogRoutes: RouteObject[] = [
  {
    index: true,
    loader: homeLoader,
    hydrateFallbackElement: <div className="h-svh bg-surface" />,
    handle: homeHandle,
    element: <HomePage />,
  },
  { path: 'shop', element: <CategoryPage /> },
  { path: 'shop/:categorySlug', element: <CategoryPage /> },
  { path: 'products/:slug', element: <ProductPage /> },
  { path: 'search', element: <SearchPage /> },
  { path: 'lookbook', element: <LookbookPage /> },
];
