import { redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { requireAuth } from '@/app/guards';
import { fetchAddresses, fetchProfile } from '@/features/account/api';
import { useCart } from '@/features/cart/store';
import { queryClient } from '@/lib/queryClient';
import { qk } from '@/lib/queryKeys';
import { fetchCartVariants, settingsQuery } from './api';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderCompletePage } from './pages/OrderCompletePage';
import { reconcileLines, type LineNotice } from './reconcile';

export type CheckoutLoaderData = { notices: Record<string, LineNotice[]> };

/**
 * Signed-in only; an empty cart goes home. Re-reads the cart's variants and updates prices, stock
 * and quantities in the cart (PLAN ⑩), and warms the address book, profile and settings caches.
 * If the variant check fails the page still opens: create_order validates everything again.
 */
async function checkoutLoader(args: LoaderFunctionArgs): Promise<CheckoutLoaderData> {
  const session = await requireAuth(args);
  const lines = useCart.getState().lines;
  if (lines.length === 0) throw redirect('/');
  const userId = session.user.id;

  const [fresh] = await Promise.all([
    fetchCartVariants(lines).catch(() => null),
    queryClient.prefetchQuery({
      queryKey: qk.addresses(userId),
      queryFn: () => fetchAddresses(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: qk.profile(userId),
      queryFn: () => fetchProfile(userId),
    }),
    queryClient.prefetchQuery(settingsQuery),
  ]);
  if (!fresh) return { notices: {} };

  const result = reconcileLines(useCart.getState().lines, fresh);
  useCart.setState({ lines: result.lines });
  return { notices: result.notices };
}

const pageFallback = <div className="min-h-svh" />;

export const checkoutRoutes: RouteObject[] = [
  {
    path: 'checkout',
    loader: checkoutLoader,
    hydrateFallbackElement: pageFallback,
    element: <CheckoutPage />,
  },
  {
    path: 'orders/:orderId/complete',
    loader: requireAuth,
    hydrateFallbackElement: pageFallback,
    element: <OrderCompletePage />,
  },
];
