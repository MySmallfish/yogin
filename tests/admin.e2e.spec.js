const { test, expect } = require('@playwright/test');
const { loginAsAdmin, tomorrowISO } = require('./helpers');

const uniqueTitle = () => `E2E Session ${Date.now()}`;

test.describe('Admin calendar', () => {
  test('toolbar layout and navigation render', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('.calendar-top')).toBeVisible();
    await expect(page.locator('.calendar-bottom')).toBeVisible();
    await expect(page.locator('.calendar-bottom .calendar-nav')).toBeVisible();
    await expect(page.locator('.calendar-bottom .calendar-actions')).toBeVisible();
  });

  test('create a one-time session and find it in list', async ({ page }) => {
    await loginAsAdmin(page);
    const title = uniqueTitle();

    await page.click('#add-session');
    await expect(page.locator('#session-modal')).toBeVisible();
    await page.fill('#session-modal input[name="title"]', title);
    await page.fill('#session-modal input[name="date"]', tomorrowISO());
    await page.fill('#session-modal input[name="startTimeLocal"]', '06:00');
    await page.fill('#session-modal input[name="durationMinutes"]', '30');

    await page.click('#save-session');
    await page.locator('#session-modal').waitFor({ state: 'detached', timeout: 20000 });

    await page.click('[data-view="list"]');
    await expect(page.locator('.calendar-list')).toBeVisible();
    await page.fill('#calendar-search', title);

    const row = page.locator('.calendar-list tbody tr', { hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 20000 });
  });

  test('calendar exports download', async ({ page }) => {
    await loginAsAdmin(page);
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-export="excel"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });
});
