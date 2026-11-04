import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { ADMIN, anonClient, expectAccessible, login } from './support/app';
import {
  auditMark,
  createUser,
  deleteUserByEmail,
  lit,
  purgeAuditSince,
  sql,
  type TestUser,
} from './support/db';

const SEED_PHOTO = fileURLToPath(
  new URL(
    '../supabase/seed-assets/products/0a49d6f3-3e4a-4cc9-ad90-14e007816023/1425a62d-21a8-4ea5-a96c-6ca91143778e.webp',
    import.meta.url,
  ),
);
const PRODUCT_SLUG = 'e2e-test-tee';

let customer: TestUser;
let mark: number;

/** Removes the e2e product with its storage objects (admin session through the Storage API). */
async function removeTestProduct() {
  const productId = sql(`select id from public.products where slug = ${lit(PRODUCT_SLUG)}`);
  if (!productId) return;
  const supabase = anonClient();
  await supabase.auth.signInWithPassword(ADMIN);
  const { data: objects } = await supabase.storage.from('products').list(productId);
  if (objects?.length) {
    await supabase.storage.from('products').remove(objects.map((o) => `${productId}/${o.name}`));
  }
  sql(`delete from public.products where id = ${lit(productId)}`);
}

test.beforeAll(async () => {
  mark = auditMark();
  customer = createUser();
  await removeTestProduct();
});

test.afterAll(async () => {
  await removeTestProduct();
  deleteUserByEmail(customer.email);
  purgeAuditSince(mark);
});

test('admin confirms a bank transfer and the customer sees it', async ({ page, browser }) => {
  // A pending order placed by the customer through the public API.
  const supabase = anonClient();
  await supabase.auth.signInWithPassword({ email: customer.email, password: customer.password });
  const variantId = sql(`
    select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.status = 'active' and v.is_active and v.stock > 0 order by p.slug, v.sku limit 1`);
  const { data, error } = await supabase.rpc('create_order', {
    p_items: [{ variant_id: variantId, quantity: 1 }],
    p_address: {
      recipient: '홍길동',
      phone: '01055556666',
      postal_code: '04524',
      address1: '서울 중구 세종대로 110',
      address2: '101호',
    },
    p_memo: '',
    p_depositor_name: '홍길동',
  });
  expect(error).toBeNull();
  const orderId = z.object({ order_id: z.uuid() }).parse(data).order_id;

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/orders/${orderId}`);
  await expect(page.getByText('입금 대기').first()).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: '입금 확인', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '입금 확인' });
  await confirm.getByRole('button', { name: '입금 확인' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('button', { name: '상품 준비중' })).toBeVisible();

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await login(customerPage, customer.email, customer.password);
  await customerPage.goto(`/account/orders/${orderId}`);
  await expect(customerPage.getByText('입금 확인').first()).toBeVisible();
  await expect(customerPage.getByText('입금 대기')).toHaveCount(0);
  await customerContext.close();
});

test('admin creates a product with a photo and it appears in the store', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin/products/new');
  await page.getByLabel('상품명').fill('E2E 테스트 티셔츠');
  await page.getByLabel('슬러그').fill(PRODUCT_SLUG);
  await page.getByLabel('판매가 (원)').fill('39000');
  await page
    .getByLabel('카테고리')
    .selectOption(sql(`select id from public.categories where slug = 'men-shirts'`));
  await page.getByLabel('상태').selectOption('active');

  await page.locator('input[type="file"]').setInputFiles(SEED_PHOTO);
  await expect(page.getByRole('textbox', { name: '1번 이미지 대체 텍스트' })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByLabel('색상', { exact: true }).fill('Black');
  await page.getByLabel('색상', { exact: true }).press('Enter');
  await page.getByLabel('사이즈', { exact: true }).fill('M');
  await page.getByLabel('사이즈', { exact: true }).press('Enter');
  await page.getByRole('textbox', { name: 'Black M 재고' }).fill('5');
  await page.getByRole('button', { name: '저장' }).first().click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('link', { name: '스토어에서 보기' })).toBeVisible();

  await page.goto(`/products/${PRODUCT_SLUG}`);
  await expect(page.getByRole('heading', { level: 1, name: 'E2E 테스트 티셔츠' })).toBeVisible();
  await expect(page.locator('main img').first()).toHaveJSProperty('complete', true);
  expect(
    await page
      .locator('main img')
      .first()
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);

  // Delete through the admin screen (also removes the storage objects).
  await page.goto('/admin/products');
  await page.getByRole('link', { name: 'E2E 테스트 티셔츠' }).first().click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  await page
    .getByRole('dialog', { name: '상품을 삭제할까요?' })
    .getByRole('button', { name: '삭제', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  expect(sql(`select count(*) from public.products where slug = ${lit(PRODUCT_SLUG)}`)).toBe('0');
});
