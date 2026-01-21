const { test, expect } = require('@playwright/test');

test('public schedule loads', async ({ page }) => {
  await page.goto('/public/');
  await expect(page.getByRole('button', { name: /open app/i })).toBeVisible();
  await expect(page.locator('header')).toBeVisible();
});

test('public legal pages load', async ({ page }) => {
  await page.goto('/public/terms.html');
  await expect(page.locator('main')).toBeVisible();
  await page.goto('/public/privacy.html');
  await expect(page.locator('main')).toBeVisible();
});
