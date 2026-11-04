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

/**
 * Loader: lets only admins through (`is_admin()` RPC); everyone else goes to "/" (signed-out users
 * to the login page when the request is known). UI convenience only — RLS and the admin functions
 * are the real defence.
 */
export async function requireAdmin(args?: Pick<LoaderFunctionArgs, 'request'>): Promise<void> {
  const session = await currentSession();
  if (!session) throw redirect(args ? loginPath(appPath(args.request)) : '/');
  const { data, error } = await supabase.rpc('is_admin');
  if (error || data !== true) throw redirect('/');
}

/** Loader for /login, /signup, /forgot-password: signed-in users go to `next` or /account. */
export async function redirectIfAuthenticated({
  request,
}: Pick<LoaderFunctionArgs, 'request'>): Promise<null> {
  const session = await currentSession();
  if (session) throw redirect(safeNext(new URL(request.url).searchParams.get('next')));
  return null;
}
