import { isAuthError } from '@supabase/supabase-js';
import { env } from '@/config/env';
import { supabase } from '@/lib/supabase';
import { PASSWORD_RULE, type SignupValues } from './schemas';

/** Absolute URL of an app path for auth email links, e.g. `auth/confirmed`. */
export function authRedirectUrl(path: string): string {
  return `${env.siteUrl}${env.basePath}${path.replace(/^\//, '')}`;
}

export const EMAIL_NOT_CONFIRMED = 'email_not_confirmed';

/** GoTrue error code (`invalid_credentials`, `email_not_confirmed`, …) or null. */
export function authErrorCode(error: unknown): string | null {
  return isAuthError(error) && typeof error.code === 'string' ? error.code : null;
}

/**
 * Korean message for a GoTrue error. Messages never reveal whether an account exists: wrong email
 * and wrong password read the same.
 */
export function authErrorMessage(error: unknown): string {
  switch (authErrorCode(error)) {
    case 'invalid_credentials':
      return '이메일 또는 비밀번호가 올바르지 않습니다';
    case EMAIL_NOT_CONFIRMED:
      return '이메일 인증 후 로그인할 수 있습니다';
    case 'weak_password':
      return PASSWORD_RULE;
    case 'same_password':
      return '현재 비밀번호와 다른 비밀번호를 입력하세요';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return '잠시 후 다시 시도하세요';
    case 'email_address_invalid':
    case 'email_exists':
      return '사용할 수 없는 이메일입니다';
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
      return '다시 로그인하세요';
    case 'reauthentication_needed':
      return '다시 로그인한 뒤 시도하세요';
    case 'signup_disabled':
      return '현재 회원가입을 받을 수 없습니다';
    default:
      return '요청을 처리하지 못했습니다';
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(values: SignupValues) {
  const { error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        name: values.name,
        phone: values.phone,
        terms_agreed: true,
        privacy_agreed: true,
        age_confirmed: true,
        marketing_agreed: values.marketingAgreed,
      },
      emailRedirectTo: authRedirectUrl('auth/confirmed'),
    },
  });
  // An already registered email returns no error (an obfuscated user), so the screen is the same
  // whether or not the account exists.
  if (error) throw error;
}

export async function resendSignupEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authRedirectUrl('auth/confirmed') },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl('auth/reset'),
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  // Local scope: clears this browser even when the server session is already gone.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
