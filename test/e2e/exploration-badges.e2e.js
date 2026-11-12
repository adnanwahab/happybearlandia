import { test, expect } from '@playwright/test';

test('inspect completed policies once, reload recognition, then clear', async ({ page }) => {
  await page.goto('/world/decision.html');
  await page.locator('#try-example').click();
  await page.locator('#auto-preview').uncheck();
  const panel = page.locator('#exploration-badges');
  const inspect = panel.getByRole('button', {name:'Inspect policy tradeoffs'});
  await expect(inspect).toBeDisabled();
  await page.locator('#run-count').selectOption('100');
  await page.locator('#run-experiment').click();
  await expect(inspect).toBeEnabled({timeout:60000});
  await inspect.click();
  await expect(panel.getByRole('list')).toContainText('Tradeoff inspector');
  await expect(panel.getByRole('list')).toContainText('Permitting explorer');
  const before = await panel.locator('li').allTextContents();
  await inspect.click();
  expect(await panel.locator('li').allTextContents()).toEqual(before);
  await page.reload();
  await expect(panel.locator('li')).toHaveCount(before.length);
  await panel.getByRole('button', {name:'Clear local badges'}).click();
  await expect(panel.locator('li')).toHaveCount(0);
  await page.reload();
  await expect(panel.locator('li')).toHaveCount(0);
});
