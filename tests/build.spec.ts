import { expect, test } from '@playwright/test';

test('built app loads the game UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.title h1')).toHaveText(/Crosswordle/);
  await expect(page.locator('.main .grid .tile').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.keyboard .key')).toHaveCount(28);
  await expect(page.locator('.help .message')).toContainText('Crosswordle');
});
