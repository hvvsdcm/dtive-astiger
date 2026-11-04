/**
 * Why `key` must not be shipped as VITE_SUPABASE_ANON_KEY, or null when it is a public client key:
 * a publishable key (`sb_publishable_…`) or a legacy JWT whose `role` claim is `anon`. Secret keys
 * (`sb_secret_…`) and service_role JWTs bypass RLS and would end up in the browser bundle.
 * Checked at build time (vite.config.ts) and when the app starts (src/config/env.ts).
 */
export function publicKeyProblem(key: string): string | null {
  if (key.startsWith('sb_secret_')) return 'is a secret key; use the publishable key';
  if (/^sb_publishable_\S+$/.test(key)) return null;
  if (key.startsWith('eyJ')) {
    const role = jwtRole(key);
    return role === 'anon' ? null : `is a JWT with role "${role ?? 'unknown'}"; use the anon key`;
  }
  return 'must be the publishable key (sb_publishable_…) or the legacy anon JWT';
}

function jwtRole(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
    return typeof claims === 'object' &&
      claims !== null &&
      'role' in claims &&
      typeof claims.role === 'string'
      ? claims.role
      : null;
  } catch {
    return null;
  }
}
