import { expect, test } from '@playwright/test';

test('home page renders app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/LeadSig|vite_react_shadcn_ts/i);
  await expect(page.locator('body')).toBeVisible();
});
