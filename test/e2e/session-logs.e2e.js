import { test, expect } from '@playwright/test';

test('logs normal entry, consent, real recorder capture, scrubber and revocation', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/logs');
  await expect(page.getByRole('heading', { name: 'Play session logs' })).toBeVisible();
  const consent = page.getByRole('checkbox'); await expect(consent).not.toBeChecked();
  await consent.check();
  // Exercise the production recorder on the lightweight logs page, without
  // depending on geography/network/model initialization in this focused test.
  await page.evaluate(async () => {
    window.hblSessionLogState = () => ({ minute: 12, seed: 42, mode: 'living', camera: [1, 2, 3], target: [0, 0, 0], secret: 'never-save' });
    await import('/world/session-recorder.js');
    document.querySelector('h1').click();
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.hblSessionRecorder.dispose());
  await page.reload();
  await page.locator('#sessions button').first().click();
  await expect(page.locator('#player')).toBeVisible();
  await page.locator('#scrubber').fill(await page.locator('#scrubber').getAttribute('max'));
  await expect(page.locator('#facts')).toContainText('seed 42');
  await page.screenshot({ path: '/private/tmp/hbl-session-logs.png', fullPage: true });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#play')).toHaveText('Pause');
  await consent.uncheck();
  await expect(page.locator('#sessions')).toContainText('No sessions saved');
  expect(await page.evaluate(() => localStorage.getItem('hbl.play-sessions.v1'))).toBe('[]');
  expect(errors).toEqual([]);
});

test('recording stays inert without consent and logs fit a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/logs');
  await page.evaluate(async () => {
    await import('/world/session-recorder.js');
    document.querySelector('h1').click();
    window.dispatchEvent(new Event('unhandledrejection'));
    window.hblSessionRecorder.flush();
  });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hbl.play-sessions.v1') || '[]'))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
