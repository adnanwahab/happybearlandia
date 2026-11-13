import { expect, test } from '@playwright/test';

test('edit drainage, compare exposures, replay a branch and run the 100-storm ensemble', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/world/storm/');
  await expect(page.locator('#run-status')).toContainText('Matched storms ready · CPU water solver · Fallback: CPU worker');
  const roads = page.getByRole('row').filter({ hasText: 'Road links closed' });
  await expect(roads.getByRole('cell')).toHaveText(['1', '1']);
  await page.getByRole('button', { name: 'Add drainage by Low Crossing' }).click();
  await expect(page.locator('#plan-edits li')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Save simulated branch' })).toBeDisabled();
  await page.getByRole('button', { name: 'Run matched storms' }).click();
  await expect(roads.getByRole('cell')).toHaveText(['1', '0']);
  await expect(page.locator('#rules')).toContainText('$480,000');
  await page.getByRole('button', { name: 'Save simulated branch' }).click();
  await expect(page.locator('#save-status')).toContainText('saved in this browser');
  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download event record' }).click();
  expect((await exportEvent).suggestedFilename()).toBe('storm-event-record.json');

  await page.locator('#tick').press('Home');
  await expect(page.locator('#step-label')).toHaveText('Step 0 of 60');
  await page.reload();
  await expect(page.locator('#step-label')).toHaveText('Step 0 of 60');
  await expect(roads.getByRole('cell')).toHaveText(['1', '0']);
  await expect(page.locator('#branches option')).toHaveCount(2);
  await page.getByRole('button', { name: 'Run 100 matched storms' }).click();
  await expect(page.locator('#ensemble-status')).toContainText('100 matched storms complete');
  await expect(page.locator('#ensemble-results')).toContainText('Road links closed');
});

test('the app uses WebGPU when a compute adapter is available', async ({ page }) => {
  await page.goto('/world/storm/');
  const available = await page.evaluate(async () => Boolean(await navigator.gpu?.requestAdapter()));
  test.skip(!available, 'This Chrome configuration has no WebGPU adapter.');
  await expect(page.locator('#run-status')).toHaveText('Matched storms ready · WebGPU water solver');
});

test('Crisis Control Room dispatches treaty crews and replays the exact recovery shift', async ({ page }) => {
  await page.goto('/world/storm/response.html');
  await expect(page.locator('#scope')).toContainText('0.0016 m rain per step');
  await page.getByLabel('Requested aid crews').selectOption('1');
  await page.getByLabel('Maximum offer (modeled USD)').fill('55000');
  await page.getByLabel('Maximum offer (modeled USD)').blur();
  for (const id of ['building/riverside-clinic', 'road/depot-spur', 'shelter']) {
    await page.locator('#action').selectOption(id);
    await page.getByRole('button', { name: 'Add to dispatch' }).click();
  }
  await expect(page.locator('#cost')).toContainText('$150,000');
  await page.getByRole('button', { name: 'Run response' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Operating services' }).getByRole('cell')).toHaveText(['0', '1']);
  await expect(page.getByRole('row').filter({ hasText: 'Households in shelter' }).getByRole('cell')).toHaveText(['0', '12']);
  await page.locator('#shift').press('Home');
  await page.locator('#shift').press('ArrowRight');
  await expect(page.locator('#events')).toContainText('dispatched · Open depot shelter');
  await page.reload();
  await expect(page.locator('#shift-label')).toHaveText('Shift 1 of 8');
  await expect(page.locator('#events')).toContainText('dispatched · Open depot shelter');
});

for (const failure of ['missing GPU', 'low storage limit', 'worker failure']) {
  test(`safe execution fallback: ${failure}`, async ({ page, browserName }) => {
    await page.addInitScript(failure => {
      window.deviceRequests = 0;
      Object.defineProperty(navigator, 'gpu', { value: failure === 'low storage limit' ? {
        requestAdapter: async () => ({ limits: { maxStorageBufferBindingSize: 1 },
          requestDevice: async () => { window.deviceRequests++; throw Error('must not request unsupported device'); } }),
      } : undefined });
      if (failure === 'worker failure') window.Worker = class { constructor() { throw Error('injected worker failure'); } };
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type === 'webgl2' || type === 'webgl' ? null : getContext.call(this, type, ...args);
      };
    }, failure);
    await page.goto('/world/storm/');
    const status = page.locator('#run-status');
    await expect(status).toContainText(`Fallback: ${failure === 'worker failure' ? 'CPU on main thread' : 'CPU worker'}`);
    await expect(status).toContainText(failure === 'low storage limit' ? 'maxStorageBufferBindingSize' : 'No WebGPU');
    if (failure === 'worker failure') await expect(status).toContainText('Worker unavailable');
    expect(await page.evaluate(() => window.deviceRequests)).toBe(0);
    await expect(page.locator('.storm-scene__toolbar')).toContainText('Top-down grid · 3D unavailable');
    await expect(page.locator('.storm-scene__canvas--2d')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Road links closed' }).getByRole('cell')).toHaveText(['1', '1']);
    await page.locator('#tick').press('Home');
    await expect(page.locator('#step-label')).toHaveText('Step 0 of 60');
    console.log(JSON.stringify({ issue: 'SHE-168', browserName, failure, recipe: await page.evaluate(() => location.search), status: await status.textContent() }));
  });
}
