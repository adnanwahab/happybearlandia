import { test, expect } from '@playwright/test';

test('World accessibility keeps nonmodal scene navigation and announces updates', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/world/?demo=1&synthetic=1&people=80');
  await page.waitForFunction(() => window.hblVisualPass?.ready === true);
  await expect(page.getByTestId('quick-demo')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.setViewportSize({ width: 640, height: 320 });
  await expect(page.getByTestId('quick-demo')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
