import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';
import { anonClient, login } from './support/app';
import {
  auditMark,
  createUser,
  deleteUserByEmail,
  lit,
  purgeAuditSince,
  sql,
  type TestUser,
} from './support/db';

/** Mailpit (supabase/config.toml [inbucket]) REST API. */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';
const PASSWORD = 'E2eSignup1234!';

const searchResult = z.object({ messages: z.array(z.object({ ID: z.string() })) });
const message = z.object({ HTML: z.string() });

const signupEmails: string[] = [];
let member: TestUser;
let mark: number;

function newSignupEmail() {
  const email = `e2e-signup-${randomUUID().slice(0, 8)}@example.com`;
  signupEmails.push(email);
  return email;
}

async function mailIds(email: string): Promise<string[]> {
  const response = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  return searchResult.parse(await response.json()).messages.map((m) => m.ID);
}

async function fillSignup(page: Page, email: string) {
  await page.goto('/signup');
  // Required fields carry a marker in their label, so address them by id.
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(PASSWORD);
  await page.locator('#signup-password-confirm').fill(PASSWORD);
  await page.locator('#signup-name').fill('가입 테스트');
}

test.beforeAll(() => {
  mark = auditMark();
  member = createUser();
});

test.afterAll(async () => {
  for (const email of [...signupEmails, member.email]) {
    deleteUserByEmail(email);
    const ids = await mailIds(email);
    if (ids.length) {
      await fetch(`${MAILPIT}/api/v1/messages`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ IDs: ids }),
      });
    }
  }
  purgeAuditSince(mark);
});

test('signup, confirm by email link, then log in', async ({ page }) => {
  const email = newSignupEmail();
  await fillSignup(page, email);
  await page.getByLabel('전체 동의').check();
  await expect(page.getByLabel('[필수] 만 14세 이상입니다')).toBeChecked();
  await page.getByRole('button', { name: '가입하기' }).click();
  await expect(page.getByRole('heading', { name: '이메일을 확인하세요' })).toBeVisible();

  await expect.poll(() => mailIds(email), { timeout: 15_000 }).toHaveLength(1);
  const [id] = await mailIds(email);
  const { HTML } = message.parse(await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json());
  // supabase/templates/confirmation.html: {{ .RedirectTo }}?token_hash=…&type=signup
  const link = /href="([^"]*token_hash=[^"]*)"/.exec(HTML)?.[1]?.replaceAll('&amp;', '&');
  expect(link).toBeTruthy();
  await page.goto(link ?? '');
  await expect(page).toHaveURL(/\/auth\/confirmed/);
  await expect(page.getByRole('heading', { name: '이메일 인증 완료' })).toBeVisible();

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account/);
});

test('signup without the age 14+ confirmation is refused on screen and by the server', async ({
  page,
}) => {
  const email = newSignupEmail();
  await fillSignup(page, email);
  await page.getByLabel('[필수] 이용약관 동의').check();
  await page.getByLabel('[필수] 개인정보 수집·이용 동의').check();
  await page.getByRole('button', { name: '가입하기' }).click();
  await expect(page.getByText('필수 항목에 동의하세요')).toBeVisible();
  await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible();

  // Same request without the flag, straight to the Auth API: the database trigger rejects it.
  const { error } = await anonClient().auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { name: '가입 테스트', terms_agreed: true, privacy_agreed: true } },
  });
  expect(error).not.toBeNull();
  expect(sql(`select count(*) from auth.users where email = ${lit(email)}`)).toBe('0');
});

test('non-admin members cannot open /admin', async ({ page }) => {
  await login(page, member.email, member.password);
  await page.goto('/admin/orders');
  await expect(page).toHaveURL((url) => !url.pathname.startsWith('/admin'));
  await expect(page.getByRole('heading', { name: '주문' })).toHaveCount(0);
});

test('login ignores off-site next targets', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  for (const next of ['//evil.example.com/x', 'https://evil.example.com', '/\\evil.example.com']) {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await login(page, member.email, member.password, `/login?next=${encodeURIComponent(next)}`);
    await expect(page).toHaveURL((url) => url.origin === origin);
  }
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await login(page, member.email, member.password, '/login?next=%2Faccount%2Forders');
  await expect(page).toHaveURL(/\/account\/orders$/);
});
