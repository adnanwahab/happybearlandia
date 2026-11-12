import { expect, test } from '@playwright/test';

async function savedFutureNavigation(page) {
  // Saved-checkpoint links live in the normal collapsible World controls.
  const controls = page.locator('#top');
  if (await controls.getAttribute('open') === null) await controls.locator(':scope > summary').click();
  const navigation = page.getByRole('navigation', { name: 'Saved future', exact: true });
  await expect(navigation).toBeVisible({ timeout: 45000 });
  return navigation;
}

test('an exact Living World future survives World, House, replay and a matched fork', async ({ page, request }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Try Today’s Features', exact: true }).click();
  await page.getByRole('button', { name: 'Create a guided demo checkpoint' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent = new URL(page.url()).searchParams.get('experiment');
  const original = await (await request.get('/api/world-experiments/' + parent)).json();
  const person = new URL(page.url()).searchParams.get('person');
  const canonical = new URL(page.url());
  canonical.searchParams.delete('experiment');
  canonical.searchParams.delete('person');
  await page.goto(canonical.href);
  await expect(page.locator('#clock')).toContainText('Minute 360');

  await page.addInitScript(() => {
    if (/^\/world\/?$/.test(location.pathname)) Object.defineProperty(navigator, 'gpu', { value: undefined });
  });
  await page.getByRole('link', { name: 'Enter this future in 3D World' }).click();
  await expect(page.locator('#view canvas')).toBeVisible();
  await expect(page.locator('#source')).toContainText('1 buildings from saved synthetic geometry');
  await expect(page.locator('#source')).toContainText('WEBGL2');
  const navigation = await savedFutureNavigation(page);
  await expect(navigation.getByRole('link', { name: 'Return to Worldline' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('entityId')).toBe('person:population:' + person);
  await navigation.getByRole('link', { name: 'Open exact household in House Simulator' }).click();
  await expect(page.getByRole('heading', { name: 'Live a day as Alex Rivera' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to Worldline' })).toHaveAttribute('href', new RegExp('experiment=' + parent));
  await page.goBack();
  await expect(page.locator('#view canvas')).toBeVisible();
  await (await savedFutureNavigation(page)).getByRole('link', { name: 'Return to Worldline' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);

  await page.getByRole('button', { name: 'Run matched fork and save child' }).click();
  await expect(page.locator('#pair')).toContainText('Tick 361');
  const child = new URL(page.url()).searchParams.get('experiment');
  expect(child).not.toBe(parent);
  const saved = await (await request.get('/api/world-experiments/' + child)).json();
  expect(saved.parentId).toBe(parent);
  expect((await (await request.get('/api/world-experiments/' + parent)).json()).checksum).toBe(original.checksum);
  await page.locator('#timeline').press('Home');
  await expect(page.locator('#clock')).toContainText('Minute 360');
  await page.reload();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  await page.locator('#timeline').press('End');
  await expect(page.locator('#pair')).toContainText('Tick 361');

  await page.locator('#timeline').press('Home');
  await expect(page.locator('#clock')).toContainText('Minute 360');
  await page.getByRole('button', { name: 'Run matched fork and save child' }).click();
  await expect(page.locator('#pair')).toBeVisible();
  const replayedId = new URL(page.url()).searchParams.get('experiment');
  expect(replayedId).not.toBe(child);
  const replayed = await (await request.get('/api/world-experiments/' + replayedId)).json();
  expect(replayed.parentId).toBe(parent);
  expect(replayed.save.view.journeyFork).toEqual(saved.save.view.journeyFork);
  expect(replayed.save.checkpoint).toEqual(saved.save.checkpoint);
});

test('invalid IDs and missing saved checkpoints are visible', async ({ page }) => {
  await page.goto('/tools/future-journey.html?experiment=bad');
  await expect(page.getByRole('status').filter({ hasText: 'Invalid saved experiment ID.' })).toBeVisible();
  await page.goto('/tools/future-journey.html?experiment=missing0001');
  await expect(page.getByRole('status').filter({ hasText: 'Saved checkpoint is missing.' })).toBeVisible();
});

test('saved World retains the exact checkpoint and return link through real Canvas fallback', async ({ page }, testInfo) => {
  await page.goto('/tools/future-journey.html');
  await page.getByRole('button', { name: 'Create a guided demo checkpoint' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent = new URL(page.url()).searchParams.get('experiment');
  const person = new URL(page.url()).searchParams.get('person');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!/^\/world\/?$/.test(location.pathname)) return;
    Object.defineProperty(navigator, 'gpu', { value: undefined });
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...options) {
      if (type === 'webgl2') return null;
      return context.call(this, type, ...options);
    };
  });
  await page.getByRole('link', { name: 'Enter this future in 3D World' }).click();
  await expect(page.locator('#view canvas[data-renderer="canvas2d"]')).toBeVisible();
  await expect(page.locator('#source')).toContainText('1 buildings from saved synthetic geometry');
  await expect(page.locator('#source')).toContainText('CANVAS2D');
  await expect.poll(() => page.evaluate(() => window.hblWorldStartup?.firstFrameMs ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.hblWorldStartup?.readyMs ?? 0)).toBeGreaterThan(0);
  const navigation = await savedFutureNavigation(page);
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
  expect(new URL(page.url()).searchParams.get('entityId')).toBe('person:population:' + person);
  await expect(navigation.getByRole('link', { name: 'Open exact household in House Simulator' })).toHaveAttribute('href', new RegExp('experiment=' + parent));
  const snapshot = await page.evaluate(() => window.hblLivingWorld.getSnapshot());
  expect(snapshot.config.seed).toBe(42);
  expect(snapshot.runtime.paused).toBe(true);
  expect(snapshot.minute).toBe(360);
  expect(await page.evaluate(() => window.hblWorldStartup.restoreError ?? null)).toBeNull();
  expect(errors).toEqual([]);
  const evidence = await page.evaluate(() => ({
    source: document.querySelector('#source').textContent,
    renderer: document.querySelector('#view canvas').dataset.renderer,
    startup: window.hblWorldStartup,
    selection: window.hblLivingWorld.getSelection(),
    snapshot: window.hblLivingWorld.getSnapshot(),
  }));
  await testInfo.attach('saved-world-canvas-fallback', { body: JSON.stringify({ parent, person, evidence, errors }, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('saved-world-canvas-fallback.png') });
  await navigation.getByRole('link', { name: 'Return to Worldline' }).click();
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);
  await expect(page.locator('#clock')).toContainText('Minute 360');
});
