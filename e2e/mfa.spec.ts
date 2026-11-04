import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN,
  adminClient,
  adminTotpSecret,
  anonClient,
  completeAdminMfa,
  expectAccessible,
  login,
  loginAdmin,
  resetAdminMfa,
  SUPABASE,
} from './support/app';
import { createUser, deleteUserByEmail, type TestUser } from './support/db';
import { totp } from './support/totp';

let customer: TestUser;

test.beforeAll(() => {
  resetAdminMfa();
  customer = createUser();
});

test.afterAll(() => {
  deleteUserByEmail(customer.email);
  resetAdminMfa();
});

/** A six-digit code that is not the current one for `secret`. */
function wrongCode(secret: string): string {
  return totp(secret) === '000000' ? '111111' : '000000';
}

/** PostgREST call with the given access token, as any HTTP client could make it. */
function rest(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/** Password-only (aal1) session of the seed admin. */
async function passwordOnlySession() {
  const { data, error } = await anonClient().auth.signInWithPassword(ADMIN);
  if (error) throw error;
  return data.session;
}

/** Puts a password-only session of the same admin into the page's stored session. */
async function dropToPasswordOnly(page: Page) {
  const session = await passwordOnlySession();
  await page.evaluate((value) => {
    const key = Object.keys(localStorage).find((name) => /^sb-.*-auth-token$/.test(name));
    if (!key) throw new Error('no stored session');
    localStorage.setItem(key, value);
  }, JSON.stringify(session));
}

test('first admin sign-in registers an authenticator app, later ones ask for a code', async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password, '/login?next=%2Fadmin%2Fcustomers');
  await expect(page).toHaveURL(/\/admin\/mfa\/setup\?next=%2Fadmin%2Fcustomers$/);
  const qr = page.getByRole('img', { name: '인증 앱 등록 QR 코드' });
  await expect(qr).toBeVisible();
  expect(await qr.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expectAccessible(page);

  const secret = (await page.locator('code').innerText()).trim();
  await page.getByLabel('인증 코드').fill(wrongCode(secret));
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await expect(page.getByText('코드가 올바르지 않습니다')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/mfa\/setup/);
  await completeAdminMfa(page, '/admin/customers');
  await expect(page.getByRole('heading', { name: '회원' })).toBeVisible();

  await page.getByRole('button', { name: '로그아웃' }).first().click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await login(page, ADMIN.email, ADMIN.password, '/login?next=%2Fadmin');
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin$/);
  await expectAccessible(page);
  await page.getByLabel('인증 코드').fill(wrongCode(adminTotpSecret()!));
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByText('코드가 올바르지 않습니다')).toBeVisible();
  await completeAdminMfa(page, '/admin');
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
});

test('a password-only admin token is refused by admin RPCs and admin-only tables', async () => {
  const session = await passwordOnlySession();
  const stats = await rest(session.access_token, 'rpc/admin_dashboard_stats', {
    method: 'POST',
    body: '{}',
  });
  expect(stats.status).toBe(400);
  expect(await stats.json()).toMatchObject({ code: 'P0001', message: 'FORBIDDEN' });
  const logs = await rest(session.access_token, 'audit_logs?select=id&limit=1');
  expect(await logs.json()).toEqual([]);
  const member = await rest(session.access_token, 'rpc/is_admin_member', {
    method: 'POST',
    body: '{}',
  });
  expect(await member.json()).toBe(true);

  const verified = await adminClient();
  const token = (await verified.auth.getSession()).data.session!.access_token;
  const allowed = await rest(token, 'rpc/admin_dashboard_stats', { method: 'POST', body: '{}' });
  expect(allowed.status).toBe(200);
});

test('an admin page whose session drops to password-only goes back to the code screen', async ({
  page,
}) => {
  await loginAdmin(page, '/admin');
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();

  // An admin function answering FORBIDDEN while the page is open.
  await dropToPasswordOnly(page);
  await page.getByRole('button', { name: '만료 주문 정리' }).click();
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin$/);
  await completeAdminMfa(page, '/admin');

  // The next move to another admin page.
  await dropToPasswordOnly(page);
  await page.getByRole('link', { name: '주문' }).first().click();
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin%2Forders$/);
  await completeAdminMfa(page, '/admin/orders');
});

test('customers and signed-out visitors never see the TOTP screens', async ({ page }) => {
  await page.goto('/admin/mfa');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fmfa/);
  await login(page, customer.email, customer.password);
  await page.goto('/admin/mfa/setup');
  await expect(page).toHaveURL((url) => !url.pathname.startsWith('/admin'));
});
