import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('the permit queue, construction theater and family share an exact replay month', async ({ page }) => {
  await page.goto('/world/hidden-systems/');
  await expect(page.getByRole('status').filter({ hasText: 'Matched futures ready.' })).toBeVisible();
  await expect(page.locator('#outcome')).toContainText('Baseline month 28 · Adjusted month 16');
  await page.getByRole('button', { name: 'Jump to first baseline delay' }).click();
  await expect(page.locator('#month-label')).toHaveText('Month 4 of 60');
  await expect(page.locator('#future')).toHaveValue('baseline');
  await page.getByRole('button', { name: 'Jump to adjusted move-in' }).click();
  await expect(page.locator('#month-label')).toHaveText('Month 16 of 60');
  await expect(page.locator('#family')).toContainText('Riverside');
  await expect(page.locator('#theater')).toContainText('Completed');
  await expect(page).toHaveURL(/month=16/);
  const selected = await page.locator('#project').inputValue();
  await page.reload();
  await expect(page.locator('#month-label')).toHaveText('Month 16 of 60');
  await expect(page.locator('#project')).toHaveValue(selected);
  await page.getByLabel('Monthly material capacity').fill('0.5');
  await page.getByRole('button', { name: 'Run matched futures' }).click();
  await expect(page.locator('#outcome')).toContainText('Adjusted month 28');
});

test('milestone effects cancel on navigation, skip, reduced motion and route exit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/vendor/three/three.module.js', route => route.abort());
  await page.goto('/world/hidden-systems/');
  await expect(page.locator('#comparison')).toBeVisible();
  await expect(page.locator('#theater')).toContainText('3D unavailable');
  const month = page.locator('#month');
  const jump = async value => month.evaluate((node, value) => {
    node.value = value;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
  await jump(4);
  await expect(page.locator('#theater')).toContainText('CONSTRUCTION_STARTED');
  await expect(page.locator('#theater')).toContainText('Project cost 420,000');
  await page.screenshot({ path: '.mini-symphony-evidence/SHE-520-after-mobile-theater.png', fullPage: true });
  const skip = page.getByRole('button', { name: 'Skip sequence' });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.construction-theater__effects span')).toHaveCount(0);
  for (const value of [16, 4, 15, 0, 4, 16, 0]) await jump(value);
  await expect(skip).toBeHidden();
  await page.getByRole('button', { name: 'Jump to first baseline delay' }).click();
  await expect(skip).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Jump to adjusted move-in' }).click();
  await expect(skip).toBeHidden();
  await expect(page.locator('#theater')).toContainText('PROJECT_COMPLETE');
  await month.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#month-label')).toContainText('Month 15');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await expect(page.locator('.construction-theater')).toHaveCount(0);
});


test('before and after desktop evidence and retained scene resource disposal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const files = ['theater.js', 'theater.css', 'model.js', 'page.js'];
  for (const file of files) {
    const body = execFileSync('git', ['show', `HEAD:world/hidden-systems/${file}`], { encoding: 'utf8' });
    await page.route(`**/world/hidden-systems/${file}`, route => route.fulfill({ body, contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript' }));
  }
  await page.goto('/world/hidden-systems/?month=4');
  await expect(page.locator('#comparison')).toBeVisible();
  await page.locator('#theater').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.mini-symphony-evidence/SHE-520-before-desktop-theater.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#theater').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.mini-symphony-evidence/SHE-520-before-mobile-theater.png' });
  await page.unrouteAll();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(page.locator('#theater')).toContainText('CONSTRUCTION_STARTED');
  await expect(page.getByRole('button', { name: 'Rotate left' })).toBeVisible();
  await page.locator('#theater').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.mini-symphony-evidence/SHE-520-after-desktop-theater.png' });
  await page.evaluate(async () => {
    const THREE = await import('/vendor/three/three.module.js');
    window.disposals = { geometry: 0, material: 0 };
    for (const [name, prototype] of [['geometry', THREE.BufferGeometry.prototype], ['material', THREE.Material.prototype]]) {
      const original = prototype.dispose;
      prototype.dispose = function () { window.disposals[name]++; return original.call(this); };
    }
  });
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Rotate left' }).click();
    await page.locator('#month').evaluate((node, value) => {
      node.value = value; node.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(i % 2 ? 4 : 16));
  }
  await page.evaluate(() => { window.disposals = { geometry: 0, material: 0 }; window.dispatchEvent(new Event('pagehide')); });
  await expect(page.locator('.construction-theater')).toHaveCount(0);
  const disposed = await page.evaluate(() => window.disposals);
  expect(disposed.geometry).toBeGreaterThan(0);
  expect(disposed.material).toBeGreaterThan(0);
});
