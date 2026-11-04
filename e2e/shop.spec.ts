import { expect, test } from '@playwright/test';
import { expectAccessible, login, stubPostcode } from './support/app';
import {
  auditMark,
  createUser,
  deleteUserByEmail,
  purgeAuditSince,
  type TestUser,
} from './support/db';

let customer: TestUser;
let mark: number;

test.beforeAll(() => {
  mark = auditMark();
  customer = createUser();
});

test.afterAll(() => {
  deleteUserByEmail(customer.email);
  purgeAuditSince(mark);
});

test('home and product pages pass the accessibility scan', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expectAccessible(page);

  await page.goto('/products/linen-short-sleeve-shirt');
  await expect(page.getByRole('heading', { level: 1, name: '린넨 반소매 셔츠' })).toBeVisible();
  await expectAccessible(page);
});

test('customer orders by bank transfer and sees it awaiting payment', async ({ page }) => {
  await stubPostcode(page);
  await login(page, customer.email, customer.password);

  // category → product
  await page.goto('/shop/men-shirts');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page
    .getByRole('link', { name: /린넨 반소매 셔츠/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/linen-short-sleeve-shirt/);

  // size → cart drawer
  await page
    .getByRole('group', { name: '색상' })
    .getByRole('button', { name: 'Light Grey' })
    .click();
  await page
    .getByRole('group', { name: '사이즈' })
    .getByRole('button', { name: 'M', exact: true })
    .click();
  await page.getByRole('button', { name: '장바구니 담기' }).first().click();
  const drawer = page.getByRole('dialog', { name: /장바구니/ });
  if (!(await drawer.isVisible())) {
    await page
      .getByRole('button', { name: /장바구니/ })
      .first()
      .click();
  }
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('린넨 반소매 셔츠')).toBeVisible();
  await drawer.getByRole('link', { name: '주문하기' }).click();

  // checkout: new address (postcode widget stubbed)
  await expect(page.getByRole('heading', { level: 1, name: '주문서' })).toBeVisible();
  await page.getByLabel('받는 분').fill('홍길동');
  await page.getByLabel('휴대폰 번호').fill('010-5555-6666');
  await page.getByRole('button', { name: '주소 검색' }).click();
  await page.getByRole('button', { name: '테스트 주소 선택' }).click();
  await page.getByLabel('상세 주소').fill('101호');
  await page.getByRole('button', { name: '이 주소로 배송' }).click();
  await expect(page.getByText('서울 중구 세종대로 110')).toBeVisible();
  await page.getByLabel('입금자명').fill('홍길동');
  await page.getByLabel('주문 내용을 확인했으며 구매에 동의합니다').check();
  await expectAccessible(page);
  await page.getByRole('button', { name: '주문하기' }).click();

  // order complete: bank account and deadline
  await expect(page.getByRole('heading', { level: 1, name: '주문 완료' })).toBeVisible();
  await expect(page.getByText('계좌번호')).toBeVisible();
  await expect(page.getByRole('button', { name: '계좌번호 복사' })).toBeVisible();
  await expect(page.getByText(/\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}까지/)).toBeVisible();

  // my orders
  await page.goto('/account/orders');
  await expect(page.getByText('입금 대기').first()).toBeVisible();
});
