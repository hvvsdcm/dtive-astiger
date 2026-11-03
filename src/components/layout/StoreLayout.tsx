import { Outlet, ScrollRestoration, useMatches } from 'react-router';
import { fallbackNav } from '@/config/site';
import { Footer } from './Footer';
import { Header } from './Header';

/** Route `handle` flags read by the store layout. */
export type StoreRouteHandle = {
  /** Render the header transparent over the page top (home hero). */
  headerOverlay?: boolean;
};

export function StoreLayout() {
  const matches = useMatches();
  const overlay = matches.some(
    (match) => (match.handle as StoreRouteHandle | undefined)?.headerOverlay,
  );

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        본문 바로가기
      </a>
      <Header nav={fallbackNav} overlay={overlay} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}
