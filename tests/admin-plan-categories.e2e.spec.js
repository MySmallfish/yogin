const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

test('manage plan categories', async ({ page }) => {
  await loginAsAdmin(page);

  await page.click('[data-route="plans"]');
  await page.click('#manage-plan-categories');
  await expect(page.locator('#plan-category-modal')).toBeVisible();

  const categoryName = `E2E Category ${Date.now()}`;
  await page.fill('#plan-category-modal input[name="planCategoryName"]', categoryName);
  await page.click('#save-plan-category');

  await page.locator('#plan-category-modal').waitFor({ state: 'detached', timeout: 20000 });

  await page.click('#manage-plan-categories');
  await expect(page.locator('#plan-category-modal')).toBeVisible();
  const row = page.locator('#plan-category-modal table tbody tr', { hasText: categoryName }).first();
  await expect(row).toBeVisible({ timeout: 20000 });

  await page.click('#close-plan-categories');
  await page.locator('#plan-category-modal').waitFor({ state: 'detached', timeout: 20000 });
});
