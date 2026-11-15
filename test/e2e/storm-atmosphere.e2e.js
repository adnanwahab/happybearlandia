import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

for (const mobile of [false, true]) test(`decorative storm atmosphere ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  // Capture the actual HEAD implementation at the same route before the local edits.
  for (const file of ['page.js', 'scene.js', 'scene.css']) {
    const body = execFileSync('git', ['show', `HEAD:world/storm/${file}`], { encoding: 'utf8' });
    await page.route(`**/world/storm/${file}`, route => route.fulfill({ body,
      contentType: file.endsWith('.css') ? 'text/css' : 'application/javascript' }));
  }
  await page.goto('/world/storm/');
  await expect(page.locator('#run-status')).toContainText('Matched storms ready');
  await page.locator('#scene').screenshot({ path: `.mini-symphony-evidence/SHE-512-storm-before-${mobile ? 'mobile' : 'desktop'}.png` });
  await page.unrouteAll();
  await page.reload();
  await expect(page.locator('#run-status')).toContainText('Matched storms ready');
  const reading = page.locator('.storm-atmosphere__reading');
  await expect(reading).toContainText('direction: unavailable');
  const toggle = page.getByLabel('Show decorative wind and clouds');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.storm-atmosphere')).toBeHidden();
  await page.keyboard.press('Space');
  await expect(page.locator('.storm-atmosphere')).toBeVisible();
  await page.locator('#tick').press('Home');
  await expect(reading).toContainText('Step 0');
  for (let i = 0; i < 20; i++) await page.locator('#tick').press('ArrowRight');
  await expect(reading).toContainText('Step 20');
  for (let i = 0; i < 6; i++) {
    const button = page.getByRole('button', { name: /Use [23]D view/ });
    if (await button.isVisible()) await button.click();
    await page.locator('#arm').selectOption(i % 2 ? 'baseline' : 'adjusted');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.storm-atmosphere i').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.locator('#scene').screenshot({ path: `.mini-symphony-evidence/SHE-512-storm-after-${mobile ? 'mobile' : 'desktop'}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Exercise cleanup while retaining the document to inspect released nodes.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator('.storm-scene')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('missing snapshot clears marks and destroy is idempotent', async ({ page }) => {
  await page.goto('/world/storm/');
  expect(await page.evaluate(async () => {
    const { mountAtmosphere } = await import('/world/storm/atmosphere.js');
    const host = document.createElement('div');
    document.body.append(host);
    const layer = mountAtmosphere(host, host);
    layer.render(12);
    layer.render(undefined);
    const hidden = host.querySelector('.storm-atmosphere').hidden;
    layer.destroy(); layer.destroy(); layer.render(20);
    const empty = host.children.length === 0;
    host.remove();
    return hidden && empty;
  })).toBe(true);
});
