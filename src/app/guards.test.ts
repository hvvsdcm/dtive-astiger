import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectIfAuthenticated, requireAdmin, requireAuth, safeNext } from './guards';

const { getSession, rpc } = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession }, rpc },
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
});

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
  it('lets admins through', async () => {
    getSession.mockResolvedValue({ data: { session } });
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(requireAdmin()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('is_admin');
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
