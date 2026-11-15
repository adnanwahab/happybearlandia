import { test, expect } from '@playwright/test';
for (const width of [1440, 390]) test(`palette workshop persists and resets at ${width}px`, async ({ page }) => {
 await page.setViewportSize({ width, height: 1000 });
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await page.goto('/world/invention/');
 await expect(page.getByRole('heading', { name: 'Neighborhood palette workshop' })).toBeVisible();
 await expect(page.locator('#palette [role=status]')).toContainText('No saved recipe');
 const original = await page.locator('#palette-after').innerHTML();
 await page.screenshot({ path: `.mini-symphony-evidence/SHE-569-workshop-original-${width}.png`, fullPage: true });
 const select = page.getByLabel('Architecture aesthetics');
 await select.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
 await expect(select).toHaveValue('cozy');
 await page.getByLabel('Vegetation aesthetics').selectOption('whimsical');
 await page.getByLabel('Lighting aesthetics').selectOption('futuristic');
 const changed = await page.locator('#palette-after').innerHTML();
 expect(changed).not.toBe(original);
 await expect(page.locator('#palette-diff')).toContainText('lighting: original → futuristic');
 await page.getByRole('button', { name: 'Save render recipe' }).click();
 await page.reload();
 await expect(page.locator('#palette-after')).toHaveJSProperty('innerHTML', changed);
 await expect(page.locator('#palette [role=status]')).toContainText('reapplied');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.screenshot({ path: `.mini-symphony-evidence/SHE-569-workshop-after-${width}.png`, fullPage: true });
 await page.getByRole('button', { name: 'Reset aesthetics' }).click();
 await expect(page.locator('#palette-after')).toHaveJSProperty('innerHTML', original);
 await page.reload(); await expect(select).toHaveValue('original');
});
test('corrupt recipes and denied storage keep a working preview', async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('hbl.neighborhood-palette.v1', '{broken'));
 await page.goto('/world/invention/');
 await expect(page.locator('#palette [role=status]')).toContainText('unsupported');
 await page.evaluate(() => {
  Storage.prototype.setItem = () => { throw new Error('denied'); };
 });
 await page.getByLabel('Architecture aesthetics').selectOption('whimsical');
 await page.getByRole('button', { name: 'Save render recipe' }).click();
 await expect(page.locator('#palette [role=status]')).toContainText('not saved');
 await expect(page.locator('#palette-diff')).toContainText('architecture: original → whimsical');
});
