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
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { env } from '@/config/env';
import { supabase } from '@/lib/supabase';

export type SessionState = {
  session: Session | null;
  user: User | null;
  /**
   * Listed in admins (`is_admin_member()`), before or after the TOTP step. UI convenience only;
   * RLS and the admin functions check `is_admin()` (admin with a TOTP-verified session).
   */
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
 *
 * A token_hash link signs the browser into the link's account, so a link someone else requested
 * could switch a visitor into that account (login CSRF). Only the type each template sends is
 * accepted, on the page its redirect points at; with someone already signed in the switch waits
 * for a confirmation. An email-change link opened by the user who requested it skips the prompt;
 * if it turns out to belong to another account, the previous session is put back.
 */
export type AuthLinkStatus = 'none' | 'pending' | 'verified' | 'failed';

/** App path (after VITE_BASE_PATH) → the one link type redirected there (authRedirectUrl callers). */
const LINK_TYPE_BY_PATH: Record<string, EmailOtpType> = {
  'auth/confirmed': 'signup',
  'auth/reset': 'recovery',
  'account/profile': 'email_change',
};

type EmailLink = { tokenHash: string; type: EmailOtpType };

let linkState: { recovery: boolean; status: AuthLinkStatus; switchPrompt: boolean } = {
  recovery: false,
  status: 'none',
  switchPrompt: false,
};
/** Link waiting for the switch confirmation. */
let promptedLink: EmailLink | null = null;
const linkListeners = new Set<() => void>();

function setLinkState(next: Partial<typeof linkState>) {
  linkState = { ...linkState, ...next };
  linkListeners.forEach((listener) => listener());
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') setLinkState({ recovery: true });
  else if (event === 'SIGNED_OUT' && linkState.recovery) setLinkState({ recovery: false });
});

/** Verifies the link; `restore` is the signed-in session to keep when the link is another user's. */
async function verifyLink(link: EmailLink, restore: Session | null) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: link.tokenHash,
    type: link.type,
  });
  if (!error && restore && data.user && data.user.id !== restore.user.id) {
    await supabase.auth.setSession(restore);
    setLinkState({ status: 'failed' });
    return;
  }
  setLinkState({ status: error ? 'failed' : 'verified' });
}

if (typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const tokenHash = url.searchParams.get('token_hash');
  const appPath = url.pathname.startsWith(env.basePath)
    ? url.pathname.slice(env.basePath.length).replace(/\/$/, '')
    : '';
  const type = LINK_TYPE_BY_PATH[appPath];
  if (
    url.searchParams.has('error_code') ||
    hash.has('error_code') ||
    url.searchParams.has('error')
  ) {
    // GoTrue redirected with an error (expired or already used link).
    linkState = { ...linkState, status: 'failed' };
  } else if (tokenHash) {
    const accepted = type !== undefined && url.searchParams.get('type') === type;
    linkState = { ...linkState, status: accepted ? 'pending' : 'failed' };
    url.searchParams.delete('token_hash');
    url.searchParams.delete('type');
    window.history.replaceState(window.history.state, '', url);
    if (accepted) {
      const link = { tokenHash, type };
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) void verifyLink(link, null);
        else if (type === 'email_change' && session.user.new_email) void verifyLink(link, session);
        else {
          promptedLink = link;
          setLinkState({ switchPrompt: true });
        }
      });
    }
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

/** Asks before an email link replaces the signed-in account; cancelling leaves for the home page. */
function AccountSwitchPrompt() {
  const open = useSyncExternalStore(
    subscribeLink,
    () => linkState.switchPrompt,
    () => false,
  );
  const cancel = () => window.location.replace(env.basePath);
  return (
    <Dialog
      open={open}
      onClose={cancel}
      title="계정 전환"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={cancel}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!promptedLink) return;
              setLinkState({ switchPrompt: false });
              void verifyLink(promptedLink, null);
              promptedLink = null;
            }}
          >
            계속
          </Button>
        </>
      }
    >
      현재 로그인한 계정 대신 링크의 계정으로 로그인합니다.
    </Dialog>
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
    void supabase.rpc('is_admin_member').then(({ data, error }) => {
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

  return (
    <SessionContext value={value}>
      {children}
      <AccountSwitchPrompt />
    </SessionContext>
  );
}

export function useSession(): SessionState {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
