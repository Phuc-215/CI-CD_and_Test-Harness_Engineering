const { test, expect } = require('@playwright/test');

test('admin boots smoke test', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
});
