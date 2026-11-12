import { expect, test } from '@playwright/test';

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
  await expect(page.locator('#top')).not.toHaveAttribute('open', '');
  await expect(page.getByRole('navigation', { name: 'Saved future', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to Worldline' })).toBeVisible({ timeout: 45000 });
  expect(new URL(page.url()).searchParams.get('entityId')).toBe('person:population:' + person);
  await page.getByRole('link', { name: 'Open exact household in House Simulator' }).click();
  await expect(page.getByRole('heading', { name: 'Live a day as Alex Rivera' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to Worldline' })).toHaveAttribute('href', new RegExp('experiment=' + parent));
  await page.goBack();
  await expect(page.locator('#view canvas')).toBeVisible();
  await page.getByRole('link', { name: 'Return to Worldline' }).click();
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

test('saved World retains its exact return link through Canvas2D fallback on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/future-journey.html');
  await page.getByRole('button', { name: 'Create a guided demo checkpoint' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent = new URL(page.url()).searchParams.get('experiment');
  const person = new URL(page.url()).searchParams.get('person');
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
  await expect(page.locator('#source')).toContainText('CANVAS2D');
  await expect(page.locator('#top')).not.toHaveAttribute('open', '');
  const navigation = page.getByRole('navigation', { name: 'Saved future', exact: true });
  await expect(navigation).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/hbl-saved-future-canvas-phone.png' });
  await navigation.getByRole('link', { name: 'Return to Worldline' }).click();
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);
  await expect(page.locator('#clock')).toContainText('Minute 360');
});

// Canvas2D is a supported fallback, so exercise the fatal path by removing it too.
test('saved World offers an exact return when every graphics backend is unavailable', async ({ page }) => {
  await page.goto('/tools/future-journey.html');
  await page.getByRole('button', { name: 'Create a guided demo checkpoint' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent = new URL(page.url()).searchParams.get('experiment');
  const person = new URL(page.url()).searchParams.get('person');
  await page.addInitScript(() => {
    if (!/^\/world\/?$/.test(location.pathname)) return;
    Object.defineProperty(navigator, 'gpu', { value: undefined });
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.getByRole('link', { name: 'Enter this future in 3D World' }).click();
  const error = page.getByRole('alert').filter({ hasText: '3D World could not start.' });
  await expect(error).toBeVisible();
  await error.getByRole('link', { name: 'Return to Worldline' }).click();
  expect(new URL(page.url()).searchParams.get('experiment')).toBe(parent);
  expect(new URL(page.url()).searchParams.get('person')).toBe(person);
  await expect(page.locator('#clock')).toContainText('Minute 360');
});
