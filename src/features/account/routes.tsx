import { Navigate, type RouteObject } from 'react-router';
import { requireAuth } from '@/app/guards';
import { AccountLayout } from './pages/AccountLayout';
import { AddressesPage } from './pages/AddressesPage';
import { ProfilePage } from './pages/ProfilePage';
import { WishlistPage } from './pages/WishlistPage';

/** /account/* — the loader guards every child. */
export const accountRoutes: RouteObject[] = [
  {
    path: 'account',
    loader: requireAuth,
    element: <AccountLayout />,
    children: [
      // S5 replaces this index with OrdersPage and adds orders / orders/:orderId.
      { index: true, element: <Navigate to="profile" replace /> },
      { path: 'addresses', element: <AddressesPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'wishlist', element: <WishlistPage /> },
    ],
  },
];
