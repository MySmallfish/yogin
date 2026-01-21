const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

const uniqueStamp = () => Date.now();

test('create a customer and find it in the list', async ({ page }) => {
  await loginAsAdmin(page);

  const stamp = uniqueStamp();
  const fullName = `E2E Customer ${stamp}`;
  const email = `e2e+${stamp}@example.com`;

  await page.click('[data-route="customers"]');
  await page.click('#add-customer');
  await expect(page.locator('#customer-modal')).toBeVisible();
  await page.fill('#customer-modal input[name="fullName"]', fullName);
  await page.fill('#customer-modal input[name="email"]', email);
  await page.selectOption('#customer-modal select[name="signedHealthView"]', 'true');
  await page.click('#save-customer');
  await page.locator('#customer-modal').waitFor({ state: 'detached', timeout: 20000 });

  await page.fill('input[name="search"]', fullName);
  await page.click('#apply-customer-filters');
  await expect(page.locator('table.table tbody tr', { hasText: fullName })).toBeVisible();
});
