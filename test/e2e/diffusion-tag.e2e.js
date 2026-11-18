import { test, expect } from '@playwright/test';
import expected from '../../world/collective-mind/diffusion-expected.json';

test('navigate to Collective Mind, predict, cancel and reopen the pinned scenario', async ({ page }) => {
  await page.goto('/world/connected-lives/');
  await page.locator('a[href="/world/collective-mind/"]').first().click();
  const panel = page.locator('#diffusion-tag');
  await expect(panel.getByRole('status')).toContainText('No source data');
  await panel.getByRole('button', { name: 'Load authored diffusion demo' }).click();
  await expect(panel.getByRole('status')).toContainText('Tick 0');
  for (const e of expected.events.filter(e => e.tick === 1)) await panel.getByLabel(e.receiverId, { exact: true }).check();
  await panel.getByRole('button', { name: 'Reveal one tick' }).click();
  await expect(panel.getByRole('status')).toContainText('Correct prediction');
  await expect(panel.getByRole('status')).toContainText('source event 0');
  await panel.getByRole('button', { name: 'Load authored diffusion demo' }).click();
  await expect(panel.getByRole('status')).toContainText('Tick 0');
  await panel.getByRole('button', { name: 'Cancel prediction' }).click();
  await expect(panel.getByRole('status')).toContainText('no tick executed');
  await expect(panel.getByRole('button', { name: 'Reveal one tick' })).toBeDisabled();
});

test('unavailable and mismatched demo show no results', async ({ page }) => {
  await page.route('**/diffusion-demo.json', route => route.fulfill({ status: 404 }));
  await page.goto('/world/collective-mind/');
  const panel = page.locator('#diffusion-tag');
  await panel.getByRole('button', { name: 'Load authored diffusion demo' }).click();
  await expect(panel.getByRole('status')).toContainText('No source data');
  await page.unroute('**/diffusion-demo.json');
  await page.route('**/diffusion-expected.json', route => route.fulfill({ json: {} }));
  await panel.getByRole('button', { name: 'Load authored diffusion demo' }).click();
  await expect(panel.getByRole('status')).toContainText('Tick 0');
  await panel.getByRole('button', { name: 'Reveal one tick' }).click();
  await expect(panel.getByRole('status')).toContainText('mismatch');
});
