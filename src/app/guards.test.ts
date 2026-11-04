import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  redirectIfAuthenticated,
  requireAdmin,
  requireAdminMfaStep,
  requireAuth,
  safeNext,
} from './guards';

const { getSession, rpc, getAuthenticatorAssuranceLevel, listFactors } = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession, mfa: { getAuthenticatorAssuranceLevel, listFactors } }, rpc },
}));

const session = { user: { id: 'u1' }, access_token: 't' };
const request = (path: string) => new Request(`http://127.0.0.1:5174${path}`);

async function thrownRedirect(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (!(error instanceof Response)) throw error;
    expect(error.status).toBe(302);
    return error.headers.get('Location');
  }
}

beforeEach(() => {
  getSession.mockReset();
  rpc.mockReset();
  getAuthenticatorAssuranceLevel.mockReset();
  listFactors.mockReset();
});

/** A signed-in admin member at `level`, with or without a verified TOTP factor. */
function adminAt(level: 'aal1' | 'aal2', hasFactor = level === 'aal2') {
  getSession.mockResolvedValue({ data: { session } });
  rpc.mockResolvedValue({ data: true, error: null });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: level, nextLevel: hasFactor ? 'aal2' : 'aal1' },
    error: null,
  });
  listFactors.mockResolvedValue({
    data: { all: [], totp: hasFactor ? [{ id: 'f1' }] : [] },
    error: null,
  });
}

describe('safeNext', () => {
  it.each([
    ['/account', '/account'],
    ['/products/coat?color=Black#size', '/products/coat?color=Black#size'],
    ['/checkout', '/checkout'],
  ])('keeps in-app path %s', (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    null,
    '',
    'https://evil.com',
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    'javascript:alert(1)',
    'account',
    '/\tevil',
    ' /account',
  ])('falls back for %j', (raw) => {
    expect(safeNext(raw)).toBe('/account');
  });

  it('uses the given fallback', () => {
    expect(safeNext('https://evil.com', '/')).toBe('/');
  });
});

describe('requireAuth', () => {
  it('returns the session when signed in', async () => {
    getSession.mockResolvedValue({ data: { session } });
    await expect(requireAuth({ request: request('/account') })).resolves.toBe(session);
  });

  it('redirects to login with the current path and query as next', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const location = await thrownRedirect(
      requireAuth({ request: request('/account/addresses?x=1') }),
    );
    expect(location).toBe(`/login?next=${encodeURIComponent('/account/addresses?x=1')}`);
  });
});

describe('requireAdmin', () => {
  it('lets TOTP-verified admins through', async () => {
    adminAt('aal2');
    await expect(requireAdmin()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('is_admin_member');
  });

  it('sends password-only admins to enrol or enter a code, returning to the path', async () => {
    adminAt('aal1', false);
    expect(await thrownRedirect(requireAdmin({ request: request('/admin/orders?page=2') }))).toBe(
      `/admin/mfa/setup?next=${encodeURIComponent('/admin/orders?page=2')}`,
    );
    adminAt('aal1', true);
    expect(await thrownRedirect(requireAdmin({ request: request('/admin/orders') }))).toBe(
      `/admin/mfa?next=${encodeURIComponent('/admin/orders')}`,
    );
  });

  it('sends signed-in non-admins home', async () => {
    getSession.mockResolvedValue({ data: { session } });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await thrownRedirect(requireAdmin())).toBe('/');
  });

  it('treats an RPC error as not admin', async () => {
    getSession.mockResolvedValue({ data: { session } });
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await thrownRedirect(requireAdmin({ request: request('/admin') }))).toBe('/');
  });

  it('sends signed-out users to login (or home without a request)', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await thrownRedirect(requireAdmin({ request: request('/admin/orders') }))).toBe(
      `/login?next=${encodeURIComponent('/admin/orders')}`,
    );
    expect(await thrownRedirect(requireAdmin())).toBe('/');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('requireAdminMfaStep', () => {
  const mfaRequest = (path: string, next = '/admin/orders') =>
    request(`${path}?next=${encodeURIComponent(next)}`);

  it('keeps an admin on the screen for their step and returns next', async () => {
    adminAt('aal1', false);
    await expect(
      requireAdminMfaStep('enroll', { request: mfaRequest('/admin/mfa/setup') }),
    ).resolves.toBe('/admin/orders');
    adminAt('aal1', true);
    await expect(
      requireAdminMfaStep('verify', { request: mfaRequest('/admin/mfa') }),
    ).resolves.toBe('/admin/orders');
  });

  it('switches to the other step', async () => {
    adminAt('aal1', true);
    expect(
      await thrownRedirect(
        requireAdminMfaStep('enroll', { request: mfaRequest('/admin/mfa/setup') }),
      ),
    ).toBe(`/admin/mfa?next=${encodeURIComponent('/admin/orders')}`);
  });

  it('sends verified admins on to a safe next, non-admins home', async () => {
    adminAt('aal2');
    expect(
      await thrownRedirect(
        requireAdminMfaStep('verify', { request: mfaRequest('/admin/mfa', 'https://evil.com') }),
      ),
    ).toBe('/admin');
    getSession.mockResolvedValue({ data: { session } });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(
      await thrownRedirect(requireAdminMfaStep('verify', { request: mfaRequest('/admin/mfa') })),
    ).toBe('/');
  });
});

describe('redirectIfAuthenticated', () => {
  it('passes signed-out visitors', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(redirectIfAuthenticated({ request: request('/login') })).resolves.toBeNull();
  });

  it('sends signed-in users to a safe next only', async () => {
    getSession.mockResolvedValue({ data: { session } });
    expect(
      await thrownRedirect(redirectIfAuthenticated({ request: request('/login?next=/checkout') })),
    ).toBe('/checkout');
    expect(
      await thrownRedirect(
        redirectIfAuthenticated({ request: request('/login?next=https://evil.com') }),
      ),
    ).toBe('/account');
  });
});
