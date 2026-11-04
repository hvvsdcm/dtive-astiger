import type { Session } from '@supabase/supabase-js';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { supabase } from '@/lib/supabase';

const DEFAULT_AFTER_LOGIN = '/account';

/**
 * A `next` target is accepted only as an in-app absolute path: starts with one "/", no "//" or "\"
 * (protocol-relative URLs), no scheme, no control characters. Anything else falls back.
 */
export function safeNext(raw: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  // The URL parser must agree that it stays on this origin (catches encoded tricks).
  const base = 'https://app.invalid';
  try {
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Path of a loader request relative to the router basename (redirects add the basename back). */
function appPath(request: Request): string {
  const url = new URL(request.url);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname =
    base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname;
  return `${pathname}${url.search}`;
}

/** Login URL that returns to `path` afterwards. */
export function loginPath(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}

async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Loader: the signed-in session, or a redirect to /login?next=<current path>. */
export async function requireAuth({
  request,
}: Pick<LoaderFunctionArgs, 'request'>): Promise<Session> {
  const session = await currentSession();
  if (!session) throw redirect(loginPath(appPath(request)));
  return session;
}

/** Where the signed-in user stands on the admin screens. */
type AdminAccess = 'signed-out' | 'not-admin' | 'enroll' | 'verify' | 'ok';

/**
 * Admins need a TOTP-verified session (aal2): without a verified factor they enrol one, otherwise
 * they enter a code. Membership comes from `is_admin_member()`, which ignores the assurance level
 * and is used for routing only; the database grants admin access through `is_admin()` (aal2).
 */
async function adminAccess(): Promise<AdminAccess> {
  const session = await currentSession();
  if (!session) return 'signed-out';
  const { data, error } = await supabase.rpc('is_admin_member');
  if (error || data !== true) return 'not-admin';
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel === 'aal2') return 'ok';
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  return factors.data.totp.length > 0 ? 'verify' : 'enroll';
}

/** TOTP screen for the step, returning to `next` (an admin path) afterwards. */
export function adminMfaPath(step: 'enroll' | 'verify', next: string): string {
  return `${step === 'enroll' ? '/admin/mfa/setup' : '/admin/mfa'}?next=${encodeURIComponent(next)}`;
}

/**
 * Loader: lets only TOTP-verified admins through. Signed-out users go to the login page (home
 * without a request), non-admins home, password-only admins to the TOTP screens. UI convenience
 * only — RLS and the admin functions are the real defence.
 */
export async function requireAdmin(args?: Pick<LoaderFunctionArgs, 'request'>): Promise<void> {
  const path = args ? appPath(args.request) : '/admin';
  const access = await adminAccess();
  if (access === 'ok') return;
  if (access === 'signed-out') throw redirect(args ? loginPath(path) : '/');
  if (access === 'not-admin') throw redirect('/');
  throw redirect(adminMfaPath(access, path));
}

/**
 * Loader of the TOTP screens: only an admin at this `step` stays; returns the safe `next` path.
 * Verified admins continue to `next`, admins at the other step are sent to that screen.
 */
export async function requireAdminMfaStep(
  step: 'enroll' | 'verify',
  { request }: Pick<LoaderFunctionArgs, 'request'>,
): Promise<string> {
  const next = safeNext(new URL(request.url).searchParams.get('next'), '/admin');
  const access = await adminAccess();
  if (access === 'signed-out') throw redirect(loginPath(appPath(request)));
  if (access === 'not-admin') throw redirect('/');
  if (access === 'ok') throw redirect(next);
  if (access !== step) throw redirect(adminMfaPath(access, next));
  return next;
}

/** Loader for /login, /signup, /forgot-password: signed-in users go to `next` or /account. */
export async function redirectIfAuthenticated({
  request,
}: Pick<LoaderFunctionArgs, 'request'>): Promise<null> {
  const session = await currentSession();
  if (session) throw redirect(safeNext(new URL(request.url).searchParams.get('next')));
  return null;
}
