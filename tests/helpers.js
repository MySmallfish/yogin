const { expect } = require('@playwright/test');

async function loginAsAdmin(page) {
  await page.goto('/admin/');
  const emailField = page.locator('input[name="email"]');
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(process.env.ADMIN_EMAIL || 'admin@letmein.local');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'admin123');
    await page.fill('input[name="studioSlug"]', process.env.STUDIO_SLUG || 'demo');
    await page.selectOption('select[name="role"]', { value: 'admin' });
    await page.click('button[type="submit"]');
  }
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.evaluate(() => {
    window.location.hash = '#/calendar';
  });
  await page.waitForSelector('.calendar-toolbar', { timeout: 30000 });
  await expect(page.locator('.calendar-toolbar')).toBeVisible();
}

function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

module.exports = {
  loginAsAdmin,
  tomorrowISO
};
