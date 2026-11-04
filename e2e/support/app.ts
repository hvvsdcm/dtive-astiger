import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { lit, sql } from './db';
import { totp } from './totp';

const env = loadEnv('development', process.cwd(), 'VITE_');

/** Local Supabase API origin and public anon key, as the browser app uses them. */
export const SUPABASE = { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY };

/** Supabase client with the public anon key, as the browser app uses it. */
export function anonClient() {
  return createClient(SUPABASE.url, SUPABASE.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const ADMIN = { email: 'admin@example.com', password: 'Admin1234!' };

export async function login(page: Page, email: string, password: string, path = '/login') {
  await page.goto(path);
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** The seed admin's verified TOTP secret (local database), or null before enrolment. */
export function adminTotpSecret(): string | null {
  return (
    sql(`select f.secret from auth.mfa_factors f join auth.users u on u.id = f.user_id
          where u.email = ${lit(ADMIN.email)} and f.status = 'verified' limit 1`) || null
  );
}

/** Removes the seed admin's TOTP factors: the next admin sign-in enrols again. Spec cleanup. */
export function resetAdminMfa(): void {
  sql(`delete from auth.mfa_factors f using auth.users u
        where u.id = f.user_id and u.email = ${lit(ADMIN.email)}`);
}

/** Signs in as the seed admin, opening `path` after the TOTP step (see completeAdminMfa). */
export async function loginAdmin(page: Page, path = '/admin') {
  await login(page, ADMIN.email, ADMIN.password, `/login?next=${encodeURIComponent(path)}`);
  await completeAdminMfa(page, path);
}

/**
 * On a TOTP screen, does what a person with an authenticator app does: registers with the key
 * shown on the setup screen, or enters a code for the registered secret; then expects `path`.
 */
export async function completeAdminMfa(page: Page, path: string) {
  await expect(page).toHaveURL(/\/admin\/mfa/);
  const enrolling = new URL(page.url()).pathname.endsWith('/setup');
  const secret = enrolling ? await page.locator('code').innerText() : adminTotpSecret();
  if (!secret) throw new Error('admin has no TOTP factor');
  await page.getByLabel('인증 코드').fill(totp(secret.trim()));
  await page.getByRole('button', { name: enrolling ? '등록' : '확인', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === path.split('?')[0]);
}

/** API client signed in as the seed admin with the TOTP step done (enrolling first if needed). */
export async function adminClient() {
  const supabase = anonClient();
  const signIn = await supabase.auth.signInWithPassword(ADMIN);
  if (signIn.error) throw signIn.error;
  let secret = adminTotpSecret();
  let factorId: string;
  if (secret) {
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    factorId = factors.data.totp[0]!.id;
  } else {
    const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (enrolled.error) throw enrolled.error;
    factorId = enrolled.data.id;
    secret = enrolled.data.totp.secret;
  }
  const verified = await supabase.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
  if (verified.error) throw verified.error;
  return supabase;
}

/**
 * Replaces the Kakao postcode widget (third-party iframe) with a button that returns a fixed
 * address through the same `oncomplete` callback.
 */
export async function stubPostcode(page: Page) {
  await page.addInitScript(() => {
    type Options = { oncomplete: (data: Record<string, string>) => void };
    class Postcode {
      options: Options;
      constructor(options: Options) {
        this.options = options;
      }
      embed(element: HTMLElement) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '테스트 주소 선택';
        button.addEventListener('click', () =>
          this.options.oncomplete({
            zonecode: '04524',
            address: '서울 중구 세종대로 110',
            roadAddress: '서울 중구 세종대로 110',
            jibunAddress: '서울 중구 태평로1가 31',
            userSelectedType: 'R',
            bname: '태평로1가',
            buildingName: '',
            apartment: 'N',
          }),
        );
        element.append(button);
      }
    }
    Object.assign(window, { kakao: { Postcode } });
  });
}

/** axe-core scan of the current page; fails on critical or serious violations. */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
    }));
  expect(blocking, `${page.url()} accessibility`).toEqual([]);
}
