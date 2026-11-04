import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, login } from './support/app';
import {
  auditMark,
  createUser,
  deleteUserByEmail,
  lit,
  purgeAuditSince,
  sql,
  type TestUser,
} from './support/db';

/**
 * Design rules (AGENTS.md) at phone and desktop widths: no horizontal overflow, no rounded corners
 * or shadows, a visible focus ring. Set E2E_SCREENSHOTS_DIR to also save full-page screenshots.
 */
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;
const screenshotDir = process.env.E2E_SCREENSHOTS_DIR;
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

let customer: TestUser;
let mark: number;

test.beforeAll(() => {
  mark = auditMark();
  customer = createUser();
  sql(`insert into public.addresses (user_id, label, recipient, phone, postal_code, address1, address2, is_default)
       values (${lit(customer.id)}, '집', '홍길동', '01055556666', '04524', '서울 중구 세종대로 110', '101호', true)`);
});

test.afterAll(() => {
  deleteUserByEmail(customer.email);
  purgeAuditSince(mark);
});

async function check(page: Page, label: string, viewport: string, fullPage = true) {
  await page.waitForLoadState('networkidle');
  const problems = await page.evaluate(() => {
    const found: string[] = [];
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width) {
      found.push(`horizontal overflow: ${document.documentElement.scrollWidth}px > ${width}px`);
    }
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      const style = getComputedStyle(element);
      const name = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}.${[...element.classList].slice(0, 3).join('.')}`;
      if (style.boxShadow !== 'none') found.push(`shadow: ${name}`);
      if (style.borderRadius !== '0px' && style.display !== 'none') {
        found.push(`radius ${style.borderRadius}: ${name}`);
      }
    }
    return [...new Set(found)];
  });
  expect(problems, `${label} @ ${viewport}`).toEqual([]);
  if (!screenshotDir) return;
  if (fullPage) {
    // Walk down once so lazy images load, then back to the top.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = (page.viewportSize()?.height ?? 800) / 2;
    for (let y = 0; y < height; y += step) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForLoadState('networkidle');
  }
  await page.screenshot({ path: join(screenshotDir, `${viewport}-${label}.png`), fullPage });
}

async function expectFocusRing(page: Page) {
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return null;
    const style = getComputedStyle(active);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline).not.toBeNull();
  expect(outline?.style).not.toBe('none');
  expect(outline?.width).not.toBe('0px');
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('store pages', async ({ page }) => {
      await page.goto('/');
      await check(page, 'home', viewport.name);
      await expectFocusRing(page);

      await page.goto('/signup');
      await expect(page.getByLabel('[필수] 만 14세 이상입니다')).toBeVisible();
      await check(page, 'signup', viewport.name);

      if (viewport.width < 1024) {
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        const menu = page.getByRole('dialog', { name: 'Menu' });
        await expect(menu).toBeVisible();
        await menu.getByRole('button', { name: 'MEN', exact: true }).click();
        await menu.evaluate((element) =>
          Promise.all(
            element.getAnimations({ subtree: true }).map((animation) => animation.finished),
          ),
        );
        await check(page, 'menu', viewport.name, false);
        await page.keyboard.press('Escape');
      }

      await page.goto('/shop/men');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await check(page, 'category', viewport.name);

      await page.goto('/products/linen-short-sleeve-shirt');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await check(page, 'product', viewport.name);

      await page
        .getByRole('group', { name: '사이즈' })
        .getByRole('button', { name: 'S', exact: true })
        .click();
      await page
        .getByRole('button', { name: '장바구니 담기' })
        .locator('visible=true')
        .first()
        .click();
      const drawer = page.getByRole('dialog', { name: /장바구니/ });
      if (!(await drawer.isVisible()))
        await page
          .getByRole('button', { name: /장바구니/ })
          .first()
          .click();
      await expect(drawer).toBeVisible();
      await drawer.evaluate((element) =>
        Promise.all(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        ),
      );
      await check(page, 'drawer', viewport.name, false);
    });

    test('checkout, order complete and admin order detail', async ({ page, browser }) => {
      await login(page, customer.email, customer.password);
      await page.goto('/products/linen-short-sleeve-shirt');
      await page
        .getByRole('group', { name: '사이즈' })
        .getByRole('button', { name: 'S', exact: true })
        .click();
      await page
        .getByRole('button', { name: '장바구니 담기' })
        .locator('visible=true')
        .first()
        .click();
      await page.goto('/checkout');
      await expect(page.getByRole('heading', { level: 1, name: '주문서' })).toBeVisible();
      await expect(page.getByText('서울 중구 세종대로 110')).toBeVisible();
      await check(page, 'checkout', viewport.name);

      await page.getByLabel('입금자명').fill('홍길동');
      await page.getByLabel('주문 내용을 확인했으며 구매에 동의합니다').check();
      await page.getByRole('button', { name: '주문하기' }).click();
      await expect(page.getByRole('heading', { level: 1, name: '주문 완료' })).toBeVisible();
      await check(page, 'order-complete', viewport.name);
      const orderId = /\/orders\/([0-9a-f-]{36})\/complete/.exec(page.url())?.[1];
      expect(orderId).toBeTruthy();

      const adminContext = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const admin = await adminContext.newPage();
      await login(admin, ADMIN.email, ADMIN.password);
      await admin.goto(`/admin/orders/${orderId}`);
      await expect(admin.getByRole('button', { name: '입금 확인', exact: true })).toBeVisible();
      await check(admin, 'admin-order', viewport.name);
      await adminContext.close();
    });
  });
}
