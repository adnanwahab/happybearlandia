import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

for (const mobile of [false, true]) test(`cutaway normal entry, keyboard and rapid navigation (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      return kind.includes('webgl') ? null : original.call(this, kind, ...args);
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Capture the actual baseline route, not the unrelated generic coordinator shots.
  for (const path of ['page.js', 'hazard-field.js', 'scene.css']) {
    const body = execFileSync('git', ['show', `cdb773a19acb5f68cd949dab2b8af148a0e1aefe:world/storm/${path}`], { encoding: 'utf8' });
    await page.route(`**/world/storm/${path}`, route => route.fulfill({ body, contentType: path.endsWith('css') ? 'text/css' : 'text/javascript' }));
  }
  await page.goto('/world/storm/');
  await expect(page.locator('#run-status')).toContainText('Matched storms ready');
  await page.locator('#hazard-field').screenshot({ path: `.mini-symphony-evidence/SHE-517-storm-before-${mobile ? 'mobile' : 'desktop'}.png` });
  await page.unrouteAll();
  await page.reload();
  await expect(page.locator('#run-status')).toContainText('Matched storms ready');
  const summary = page.getByText('Water depth cutaway · selected grid row', { exact: true });
  await summary.focus();
  await summary.press('Enter');
  const columns = page.getByRole('group', { name: 'Depth cutaway columns' }).getByRole('button');
  await expect(columns).toHaveCount(32);
  await expect(page.locator('.storm-cutaway')).toContainText('not a forecast');
  await page.getByLabel('Grid row', { exact: true }).fill('2');
  await page.getByLabel('Grid column', { exact: true }).fill('3');
  await page.getByLabel('Grid column', { exact: true }).press('Enter');
  await expect(columns.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await columns.nth(4).focus();
  await columns.nth(4).press('Enter');
  await expect(page.getByLabel('Grid column', { exact: true })).toHaveValue('5');
  await page.locator('#tick').press('Home');
  await expect(columns.nth(4)).toContainText('0.000 m');
  for (let i = 0; i < 12; i++) {
    await page.locator('#tick').press(i % 2 ? 'Home' : 'End');
    await page.locator('#arm').selectOption(i % 2 ? 'baseline' : 'adjusted');
  }
  await expect(page.locator('.storm-cutaway [role=status]')).toContainText('baseline · step 0');
  await expect(columns.nth(4)).toContainText('0.000 m');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.storm-cutaway').screenshot({ path: `.mini-symphony-evidence/SHE-517-storm-after-${mobile ? 'mobile' : 'desktop'}.png` });
  // pagehide is also the real route departure hook; repeated calls must be safe.
  await page.evaluate(() => { dispatchEvent(new Event('pagehide')); dispatchEvent(new Event('pagehide')); });
  await expect(page.locator('.storm-cutaway')).toHaveCount(0);
  await expect(page.locator('.storm-scene')).toHaveCount(0);
  await page.goto('/world/storm/');
  await expect(page.locator('#run-status')).toContainText('Matched storms ready');
  expect(errors).toEqual([]);
});

test('empty, missing, overflow and no-canvas text fallback with disposal', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/world/storm/');
  await expect(page.locator('#run-status')).toContainText('Matched storms ready');
  await page.evaluate(async () => {
    const { mountDepthCutaway } = await import('/world/storm/cutaway.js');
    const host = document.createElement('section');
    host.id = 'cutaway-fixture'; document.body.append(host);
    const view = mountDepthCutaway(host, () => {});
    host.querySelector('details').open = true;
    view.render({ size: 2, selected: 0, depth: [null, 1.5], provenance: 'disposable synthetic fixture' });
    window.fixtureView = view;
  });
  const host = page.locator('#cutaway-fixture');
  await expect(host.getByRole('button').nth(0)).toHaveAccessibleName('Column 1: missing');
  await expect(host.getByRole('button').nth(1)).toHaveAccessibleName('Column 2: 1.500 m, above fixed scale');
  await page.evaluate(() => window.fixtureView.render(null));
  await expect(host).toContainText('No supported depth row available.');
  await expect(host.getByRole('button')).toHaveCount(0);
  await page.evaluate(() => { window.fixtureView.destroy(); window.fixtureView.destroy(); window.fixtureView.render({}); });
  await expect(host.locator('details')).toHaveCount(0);
});
