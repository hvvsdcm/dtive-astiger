import { Navigate, type RouteObject } from 'react-router';
import { requireAuth } from '@/app/guards';
import { AccountLayout } from './pages/AccountLayout';
import { AddressesPage } from './pages/AddressesPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProfilePage } from './pages/ProfilePage';
import { WishlistPage } from './pages/WishlistPage';

/** /account/* — the loader guards every child. */
export const accountRoutes: RouteObject[] = [
  {
    path: 'account',
    loader: requireAuth,
    element: <AccountLayout />,
    children: [
      // The index is the order list; redirecting keeps the "주문내역" tab highlighted.
      { index: true, element: <Navigate to="orders" replace /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:orderId', element: <OrderDetailPage /> },
      { path: 'addresses', element: <AddressesPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'wishlist', element: <WishlistPage /> },
    ],
  },
];
