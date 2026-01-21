const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

const uniqueStamp = () => Date.now();

test('create a room and plan', async ({ page }) => {
  await loginAsAdmin(page);

  const stamp = uniqueStamp();
  const roomName = `E2E Room ${stamp}`;
  const planName = `E2E Plan ${stamp}`;

  await page.click('[data-route="rooms"]');
  await page.click('#add-room');
  await expect(page.locator('#room-modal')).toBeVisible();
  await page.fill('#room-modal input[name="roomName"]', roomName);
  await page.click('#save-room');
  await page.locator('#room-modal').waitFor({ state: 'detached', timeout: 20000 });
  await expect(page.locator('table.table tbody tr', { hasText: roomName })).toBeVisible();

  await page.click('[data-route="plans"]');
  await page.click('#add-plan');
  await expect(page.locator('#plan-modal')).toBeVisible();
  await page.fill('#plan-modal input[name="planName"]', planName);
  await page.selectOption('#plan-modal select[name="planType"]', 'WeeklyLimit');
  await page.fill('#plan-modal input[name="weeklyLimit"]', '2');
  await page.fill('#plan-modal input[name="price"]', '120');
  await page.click('#save-plan');
  await page.locator('#plan-modal').waitFor({ state: 'detached', timeout: 20000 });
  await expect(page.locator('table.table tbody tr', { hasText: planName })).toBeVisible();
});
