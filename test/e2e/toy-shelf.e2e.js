import { test, expect } from '@playwright/test';

test('scene 1 toy shelf supports keyboard actions, reduced motion and a narrow viewport', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/game/1');
  const shelf = page.locator('#toy-shelf');
  await expect(shelf).toBeVisible();
  await shelf.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(shelf).toHaveAttribute('open', '');
  const tumble = shelf.getByRole('button', { name: 'Tumble', exact: true });
  await tumble.focus(); await page.keyboard.press('Enter');
  await expect(shelf.getByRole('status')).toContainText('Reduce motion');
  await expect(tumble).toBeFocused();
  const stack = shelf.getByRole('button', { name: 'Stack', exact: true });
  await stack.focus(); await page.keyboard.press('Enter');
  await expect(shelf.getByRole('status')).toContainText('tower ready');
  await expect(stack).toBeFocused();
  await expect(page.locator('#honey-trail')).toContainText('0 / 8 collected');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('toy-shelf-mobile-reduced.png') });
  await testInfo.attach('toy-shelf-mobile-reduced', { path: testInfo.outputPath('toy-shelf-mobile-reduced.png'), contentType: 'image/png' });
});

test('other scenes have no toy shelf and Jolt failure retains startup fallback', async ({ page }) => {
  await page.goto('/game/2');
  await expect(page.locator('#container canvas')).toBeVisible();
  await expect(page.locator('#toy-shelf')).toHaveCount(0);
  await page.route('**/vendor/jolt/**', route => route.abort());
  await page.goto('/game/1');
  await expect(page.locator('#container')).toContainText('Unable to start game');
  await expect(page.locator('#toy-shelf')).toHaveCount(0);
});
