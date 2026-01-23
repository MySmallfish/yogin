const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

const uniqueStamp = () => Date.now();

test('create a series and generate sessions', async ({ page }) => {
  await loginAsAdmin(page);

  const stamp = uniqueStamp();
  const title = `E2E Series ${stamp}`;

  await page.click('[data-route="events"]');
  await page.click('#add-series');
  await expect(page.locator('#series-modal')).toBeVisible();
  await page.fill('#series-modal input[name="title"]', title);
  await page.check('#series-modal input[name="seriesDays"][value="2"]');
  await page.check('#series-modal input[name="seriesDays"][value="4"]');
  await page.fill('#series-modal input[name="startTimeLocal"]', '07:00');
  await page.fill('#series-modal input[name="durationMinutes"]', '45');
  await page.fill('#series-modal input[name="capacity"]', '10');
  const createResponse = page.waitForResponse((response) =>
    response.url().includes('/api/admin/event-series') && response.request().method() === 'POST'
  );
  await page.click('#save-series');
  await page.locator('#series-modal').waitFor({ state: 'detached', timeout: 20000 });
  const response = await createResponse;
  expect(response.ok()).toBeTruthy();

  const row = page.locator('table.table tbody tr', { hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 20000 });

  await expect(row).toBeVisible();
});
