import { expect, test } from '@playwright/test';

test.use({ video: 'on' });

test('CPU hazard fields follow selected tile, matched arm and recorded step', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.route('**/vendor/three/three.module.js', route => route.abort());
  await page.goto('/world/storm/');
  await expect(page.locator('#run-status')).toContainText('CPU water solver');
  await expect(page.locator('#hazard-reading')).toContainText('Model uncertainty: unquantified');
  await expect(page.locator('#hazard-reading')).toContainText('seed 2911 · adjusted · step 60');
  await page.getByLabel('Grid row', { exact: true }).fill('16');
  await page.getByLabel('Grid column', { exact: true }).fill('19');
  await page.getByRole('button', { name: 'Select cell', exact: true }).click();
  await page.getByLabel('Hazard field', { exact: true }).selectOption('drains');
  await expect(page.locator('#hazard-reading')).toContainText('0.000 m per step');
  await page.locator('#hazard-field').screenshot({ path: 'output/she-160-before-drainage.png' });
  await page.getByRole('button', { name: 'Add drainage by Low Crossing' }).click();
  await page.getByRole('button', { name: 'Run matched storms' }).click();
  await expect(page.locator('#hazard-reading')).toContainText('0.150 m per step');
  await page.locator('#hazard-field').screenshot({ path: 'output/she-160-after-drainage.png' });
  await page.locator('#arm').selectOption('baseline');
  await expect(page.locator('#hazard-reading')).toContainText('0.000 m per step');
  await expect(page.locator('#hazard-reading')).toContainText('baseline · step 60');
  await page.locator('#tick').press('Home');
  await page.getByLabel('Hazard field', { exact: true }).selectOption('depth');
  await expect(page.locator('#hazard-reading')).toContainText('modeled value · 0.000 m');
  await expect(page.locator('#hazard-reading')).toContainText('step 0');
  await page.locator('#hazard-field').screenshot({ path: 'output/she-160-hazard-fields.png' });
});
