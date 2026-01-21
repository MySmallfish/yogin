const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

test('admin routes render without errors', async ({ page }) => {
  await loginAsAdmin(page);

  const routes = [
    { route: 'calendar', selector: '.calendar-toolbar' },
    { route: 'reports', selector: '.cards .card:first-child' },
    { route: 'customers', selector: '#add-customer' },
    { route: 'guests', selector: '#add-guest' },
    { route: 'rooms', selector: '#add-room' },
    { route: 'plans', selector: '#add-plan' },
    { route: 'events', selector: '#add-series' },
    { route: 'users', selector: '#add-user' },
    { route: 'payroll', selector: 'select[name="payrollInstructor"]' },
    { route: 'audit', selector: '#apply-audit' },
    { route: 'settings', selector: '#save-settings' }
  ];

  for (const { route, selector } of routes) {
    await page.click(`[data-route="${route}"]`);
    await page.waitForFunction((next) => window.location.hash.includes(next), route);
    await expect(page.locator(selector)).toBeVisible();
  }
});
