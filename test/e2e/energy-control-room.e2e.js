import { test, expect } from '@playwright/test';

test('navigate from Hidden Systems and solve all three declared waves', async ({ page }) => {
  await page.goto('/world/hidden-systems/');
  await page.getByRole('link', { name: 'Play Energy Control Room' }).click();
  await expect(page.getByRole('heading', { name: 'Energy Control Room', exact: true })).toBeVisible();
  await expect(page.locator('#energy-status')).toContainText('No source data');
  await expect(page.locator('#commit')).toBeDisabled();
  await page.getByRole('button', { name: 'Load authored demo / Restart' }).click();
  await expect(page.locator('#source')).toContainText('"observations": null');
  for(let i=0;i<3;i++) await page.getByRole('button', { name: 'Dispatch wave' }).click();
  await expect(page.locator('#energy-status')).toContainText('success');
  await page.getByRole('button', { name: 'Verify replay' }).click();
  await expect(page.locator('#verification')).toContainText('Replay verified');
  await page.getByRole('link', { name: 'Hidden Systems', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hidden Systems', exact: true })).toBeVisible();
});

test('mobile keyboard cancel and failure retain only executed results', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/world/hidden-systems/energy.html');
  const load=page.getByRole('button',{name:'Load authored demo / Restart'});
  await load.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Cancel run'}).click();
  await expect(page.locator('#checkpoints')).toHaveText('No results.');
  await expect(page.locator('#energy-status')).toContainText('cancelled');
  await load.click();
  await page.getByLabel('Generation units').fill('0');
  await page.getByRole('button',{name:'Dispatch wave'}).click();
  await expect(page.locator('#energy-status')).toContainText('failed');
  await expect(page.locator('#checkpoints')).toContainText('"unmet": 2');
  await expect(page.locator('#commit')).toBeDisabled();
});
