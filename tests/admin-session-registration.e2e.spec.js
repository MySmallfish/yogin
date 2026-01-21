const { test, expect } = require('@playwright/test');
const { loginAsAdmin, tomorrowISO } = require('./helpers');

const uniqueStamp = () => Date.now();

test('register a customer to a session from the calendar', async ({ page }) => {
  await loginAsAdmin(page);

  const stamp = uniqueStamp();
  const fullName = `E2E Customer ${stamp}`;
  const email = `e2e+${stamp}@example.com`;
  const sessionTitle = `E2E Session ${stamp}`;

  await page.click('[data-route="customers"]');
  await page.click('#add-customer');
  await expect(page.locator('#customer-modal')).toBeVisible();
  await page.fill('#customer-modal input[name="fullName"]', fullName);
  await page.fill('#customer-modal input[name="email"]', email);
  await page.selectOption('#customer-modal select[name="signedHealthView"]', 'true');
  await page.click('#save-customer');
  await page.locator('#customer-modal').waitFor({ state: 'detached', timeout: 20000 });

  await page.click('[data-route="calendar"]');
  await page.click('#add-session');
  await expect(page.locator('#session-modal')).toBeVisible();
  await page.fill('#session-modal input[name="title"]', sessionTitle);
  await page.fill('#session-modal input[name="date"]', tomorrowISO());
  await page.fill('#session-modal input[name="startTimeLocal"]', '08:00');
  await page.fill('#session-modal input[name="durationMinutes"]', '45');
  await page.click('#save-session');
  await page.locator('#session-modal').waitFor({ state: 'detached', timeout: 20000 });

  await page.click('[data-view="list"]');
  await page.fill('#calendar-search', sessionTitle);
  const row = page.locator('.calendar-list tbody tr', { hasText: sessionTitle }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.click();

  await expect(page.locator('#session-modal')).toBeVisible();
  const lookupValue = `${fullName} (${email})`;
  await page.fill('#session-modal input[name="customerLookup"]', lookupValue);
  await page.dispatchEvent('#session-modal input[name="customerLookup"]', 'change');
  await page.click('#register-customer');

  const rosterRow = page.locator('.roster .customer-name', { hasText: fullName }).first();
  await expect(rosterRow).toBeVisible({ timeout: 20000 });
});
