import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

const env = loadEnv('development', process.cwd(), 'VITE_');

/** Supabase client with the public anon key, as the browser app uses it. */
export function anonClient() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
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
