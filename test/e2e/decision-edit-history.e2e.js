import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const evidence = '.mini-symphony-evidence';

test('five edits undo/redo, branching, committed reload and immutable run receipt', async ({ page }) => {
  await page.goto('/world/decision.html');
  await expect(page.locator('#parameter-permitting_months')).toBeVisible();
  await expect(page.locator('#undo-edit')).toBeDisabled();
  await expect(page.locator('#redo-edit')).toBeDisabled();
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/SHE-471-editor-before.png` });
  await page.locator('#try-example').click(); await page.locator('#auto-preview').uncheck();
  await page.locator('#run-count').selectOption('10'); await page.locator('#run-experiment').click();
  await expect.poll(() => page.evaluate(() => window.hblDecisionStudio.state.experiment?.status)).toBe('completed');
  const receipt = await page.evaluate(() => JSON.stringify(window.hblDecisionStudio.state.results));
  const id = await page.evaluate(() => window.hblDecisionStudio.state.experiment.id);
  const manifest = await page.request.get(`/api/decision-experiments/${id}/manifest`);
  expect(manifest.ok()).toBe(true); const originalManifest = await manifest.json();
  const parameter = page.locator('#parameter-permitting_months');
  const timings = [];
  for (const value of ['7','8','9','10','11']) {
    const start = Date.now(); await parameter.fill(value); timings.push(Date.now() - start);
  }
  for (const value of ['10','9','8','7','6']) { await page.locator('#undo-edit').click(); await expect(parameter).toHaveValue(value); }
  for (const value of ['7','8','9','10','11']) { await page.locator('#redo-edit').click(); await expect(parameter).toHaveValue(value); }
  expect(await page.evaluate(() => JSON.stringify(window.hblDecisionStudio.state.results))).toBe(receipt);
  const after = await page.request.get(`/api/decision-experiments/${id}/manifest`);
  expect(await after.json()).toEqual(originalManifest);
  await page.locator('#undo-edit').focus(); await page.keyboard.press('Control+z');
  await expect(parameter).toHaveValue('10');
  await page.keyboard.press('Control+Shift+z'); await expect(parameter).toHaveValue('11');
  await page.locator('#undo-edit').click(); await parameter.fill('12'); await expect(page.locator('#redo-edit')).toBeDisabled();
  await page.locator('#save-project').click(); await page.reload(); await expect(parameter).toHaveValue('12');
  await expect(page.locator('#undo-edit')).toBeDisabled();
  await page.screenshot({ path: `${evidence}/SHE-471-editor-after.png` });
  await writeFile(`${evidence}/SHE-471-edit-timing.json`, JSON.stringify({ fixture: '10 runs per scenario, synthetic housing, seed 42', measurement: 'Playwright fill round trip in ms; includes automation', timings }, null, 2));
  await page.goto(`/world/decision.html?experiment=${id}&readonly=1`);
  await expect(page.locator('#readonly-banner')).toBeVisible(); await expect(page.locator('#undo-edit')).toBeDisabled(); await expect(page.locator('#redo-edit')).toBeDisabled();
});

test('touch targets work with reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.goto(test.info().project.use.baseURL + '/world/decision.html');
  const parameter = page.locator('#parameter-permitting_months'); await expect(parameter).toBeVisible();
  const original = await parameter.inputValue(); await parameter.fill('20');
  await page.locator('#undo-edit').tap(); await expect(parameter).toHaveValue(original);
  await page.locator('#redo-edit').tap(); await expect(parameter).toHaveValue('20');
  const box = await page.locator('#undo-edit').boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${evidence}/SHE-471-editor-mobile-after.png` }); await context.close();
});
