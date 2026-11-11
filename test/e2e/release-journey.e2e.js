import { expect, test } from '@playwright/test';

test('an exact Living World future survives World, House, replay and a matched fork', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try Today’s Features', exact: true }).click();
  await page.getByRole('button', { name: 'Create a guided demo checkpoint' }).click();
  await expect(page.locator('#clock')).toContainText('Minute 360');
  const parent = new URL(page.url()).searchParams.get('experiment');
  const original = await (await request.get('/api/world-experiments/' + parent)).json();
  const person = new URL(page.url()).searchParams.get('person');

  await page.addInitScript(() => {
    if (location.pathname === '/world') Object.defineProperty(navigator, 'gpu', { value: undefined });
  });
  await page.getByRole('link', { name: 'Enter this future in 3D World' }).click();
  await expect(page.locator('#view canvas')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to Worldline' })).toBeVisible();
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
  await page.locator('#timeline').press('Home');
  await page.getByRole('button', { name: 'Run matched fork and save child' }).click();
  await expect(page.locator('#fork-status')).toContainText('Saved the edited child.');
  const replay = new URL(page.url()).searchParams.get('experiment');
  const repeated = await (await request.get('/api/world-experiments/' + replay)).json();
  expect(repeated.parentId).toBe(parent);
  expect(repeated.save.checkpoint).toEqual(saved.save.checkpoint);
  expect(repeated.save.view.journeyFork).toEqual(saved.save.view.journeyFork);
});

test('invalid IDs and missing saved checkpoints are visible', async ({ page }) => {
  await page.goto('/tools/future-journey.html?experiment=bad');
  await expect(page.getByRole('status').filter({ hasText: 'Invalid saved experiment ID.' })).toBeVisible();
  await page.goto('/tools/future-journey.html?experiment=missing0001');
  await expect(page.getByRole('status').filter({ hasText: 'Saved checkpoint is missing.' })).toBeVisible();
});
