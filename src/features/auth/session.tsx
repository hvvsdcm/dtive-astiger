/* eslint-disable react-refresh/only-export-components -- PLAN ⑦ fixes SessionProvider and its
   hooks in this one module; edits here do a full reload instead of a hot swap. */
import type { EmailOtpType, Session, User } from '@supabase/supabase-js';
import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';

export type SessionState = {
  session: Session | null;
  user: User | null;
  /** UI convenience only; RLS and the admin functions re-check `is_admin()` on the server. */
  isAdmin: boolean;
  /** True until the stored session (and any auth code in the URL) has been read. */
  loading: boolean;
};

/*
 * Email-link state, kept at module level so it is set up at import time, before supabase-js
 * finishes processing the URL. A PASSWORD_RECOVERY event fired during that work would otherwise be
 * missed by components that subscribe later (the reset page).
 *
 * Two link shapes are handled:
 * - `?code=` (PKCE, `{{ .ConfirmationURL }}` templates): supabase-js exchanges it itself. Only
 *   works in the browser that requested the email, within the flow-state lifetime.
 * - `?token_hash=&type=` (`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=…` templates):
 *   verified here with verifyOtp, valid for otp_expiry and in any browser.
 */
export type AuthLinkStatus = 'none' | 'pending' | 'verified' | 'failed';

const LINK_TYPES: Record<string, EmailOtpType> = {
  signup: 'signup',
  email: 'email',
  recovery: 'recovery',
  email_change: 'email_change',
  invite: 'invite',
  magiclink: 'magiclink',
};

let linkState: { recovery: boolean; status: AuthLinkStatus } = { recovery: false, status: 'none' };
const linkListeners = new Set<() => void>();

function setLinkState(next: Partial<typeof linkState>) {
  linkState = { ...linkState, ...next };
  linkListeners.forEach((listener) => listener());
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') setLinkState({ recovery: true });
  else if (event === 'SIGNED_OUT' && linkState.recovery) setLinkState({ recovery: false });
});

if (typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const tokenHash = url.searchParams.get('token_hash');
  const type = LINK_TYPES[url.searchParams.get('type') ?? ''];
  if (
    url.searchParams.has('error_code') ||
    hash.has('error_code') ||
    url.searchParams.has('error')
  ) {
    // GoTrue redirected with an error (expired or already used link).
    linkState = { recovery: false, status: 'failed' };
  } else if (tokenHash && type) {
    linkState = { recovery: false, status: 'pending' };
    url.searchParams.delete('token_hash');
    url.searchParams.delete('type');
    window.history.replaceState(window.history.state, '', url);
    void supabase.auth
      .verifyOtp({ token_hash: tokenHash, type })
      .then(({ error }) => setLinkState({ status: error ? 'failed' : 'verified' }));
  }
}

function subscribeLink(listener: () => void) {
  linkListeners.add(listener);
  return () => linkListeners.delete(listener);
}

/** Whether this page load came from an email link, and how verifying it went. */
export function useAuthLinkStatus(): AuthLinkStatus {
  return useSyncExternalStore(
    subscribeLink,
    () => linkState.status,
    () => 'none',
  );
}

/** True once a password-recovery link has signed the user in during this page load. */
export function usePasswordRecovery(): boolean {
  return useSyncExternalStore(
    subscribeLink,
    () => linkState.recovery,
    () => false,
  );
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<{ userId: string; value: boolean } | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    // Only set state here: awaiting other supabase calls inside this callback can deadlock the
    // client's auth lock.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void supabase.rpc('is_admin').then(({ data, error }) => {
      if (active) setAdmin({ userId, value: !error && data === true });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const value: SessionState = {
    session,
    user: session?.user ?? null,
    isAdmin: userId !== null && admin?.userId === userId && admin.value,
    loading,
  };

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
