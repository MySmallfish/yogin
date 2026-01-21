const { test, expect } = require('@playwright/test');

test('public schedule loads', async ({ page }) => {
  await page.goto('/public/index.html');
  await expect(page.locator('#app')).toBeVisible();
});

test('public legal pages load', async ({ page }) => {
  await page.goto('/public/terms.html');
  await expect(page.locator('#legal-content')).toBeVisible();
  await page.goto('/public/privacy.html');
  await expect(page.locator('#legal-content')).toBeVisible();
});
