import type { RouteObject } from 'react-router';
import { redirectIfAuthenticated } from '@/app/guards';
import { ConfirmedPage } from './pages/ConfirmedPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignupPage } from './pages/SignupPage';

export const authRoutes: RouteObject[] = [
  { path: 'login', loader: redirectIfAuthenticated, element: <LoginPage /> },
  { path: 'signup', loader: redirectIfAuthenticated, element: <SignupPage /> },
  { path: 'forgot-password', loader: redirectIfAuthenticated, element: <ForgotPasswordPage /> },
  // No redirect: the recovery and confirmation links sign the user in on these pages.
  { path: 'auth/reset', element: <ResetPasswordPage /> },
  { path: 'auth/confirmed', element: <ConfirmedPage /> },
];
