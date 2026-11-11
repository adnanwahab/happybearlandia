import { expect, test } from '@playwright/test';

test('Timeline Braids compares saved siblings and hands off exact checkpoints', async ({ page }) => {
  await page.goto('/world/connected-lives/');
  const fixture = await page.evaluate(async () => {
    const { createPopulationRuntime } = await import('/world/population/runtime.js');
    const { createPopulationCheckpoint, readPopulationCheckpoint } = await import('/world/population/checkpoint.js');
    const runtime = createPopulationRuntime({ config: { population: 60, seed: 31 }, stepMinutes: 1 });
    const stamp = Date.now();
    async function save(checkpoint, label, person, parentId) {
      const response = await fetch('/api/world-experiments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'world-experiment-save.v1', label: label + ' ' + stamp, parentId, mode: 'living', checkpoint,
          view: { origin: { lat: 29.7286, lng: -95.4746 }, selection: { type: 'person', id: person } },
          geometry: { area: {} },
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }
    try {
      await runtime.ready;
      const checkpoint = await runtime.exportCheckpoint();
      const person = readPopulationCheckpoint(checkpoint).model.prefix + '-p0';
      const root = await save(checkpoint, 'Braid root', person);
      await runtime.step();
      const next = readPopulationCheckpoint(await runtime.exportCheckpoint());
      await save(createPopulationCheckpoint(next), 'First future', person, root.id);
      next.model.people.income[0] += 2000;
      const right = await save(createPopulationCheckpoint(next), 'Second future', person, root.id);
      return { root: root.id, right: right.id, person, stamp };
    } finally {
      runtime.destroy();
    }
  });

  await page.getByRole('link', { name: 'Timeline Braids' }).click();
  await page.getByRole('combobox', { name: /Starting checkpoint/ }).selectOption(fixture.root);
  await page.getByRole('button', { name: 'Open timelines' }).click();
  await expect(page.locator('#coverage')).toContainText('2 saved branches');
  await expect(page.locator('#difference')).toContainText('Modeled annual income');
  await expect(page.locator('#braid path')).toHaveCount(2);
  await page.getByRole('button', { name: new RegExp('Second future ' + fixture.stamp) }).click();
  await expect(page.getByRole('link', { name: 'Open World checkpoint' })).toHaveAttribute('href', '/world?experiment=' + fixture.right);
  await expect(page.getByRole('link', { name: 'Open resident in Playable Life' })).toHaveAttribute('href',
    new RegExp('experiment=' + fixture.right + '&person=' + fixture.person + '&playableLife=1'));
  await page.reload();
  await expect(page.locator('#difference')).toContainText('First difference at a shared saved minute · 1');
  await expect(page.getByRole('link', { name: 'Open World checkpoint' })).toHaveAttribute('href', '/world?experiment=' + fixture.right);
  await page.getByRole('link', { name: 'Zoom into this resident' }).click();
  await expect(page.locator('#identity')).toContainText('Checkpoint ' + fixture.right);
  await expect(page.locator('#identity')).toContainText('Minute 1');
  await expect(page.getByRole('link', { name: 'Open this resident in House Simulator' })).toHaveAttribute('href',
    new RegExp('experiment=' + fixture.right + '&person=' + fixture.person + '&playableLife=1'));
  await page.getByRole('navigation', { name: 'Zoom levels' }).getByRole('button', { name: 'City', exact: true }).click();
  await expect(page.locator('#title')).toHaveText('City');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Recorded relationships' })).toBeVisible();
});

test('Collective Mind changes network rules and replays the selected round', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/world/connected-lives/');
  await page.getByRole('link', { name: 'Collective Mind' }).click();
  await expect(page.locator('#network canvas:visible')).toBeVisible();
  await page.locator('select[name=network]').selectOption('citywide');
  await page.getByRole('button', { name: 'Run experiment' }).click();
  await expect(page.locator('#status')).toContainText('Citywide network');
  await page.locator('#round').press('End');
  await expect(page.locator('#round-output')).toHaveText('60 of 60');
  const values = await page.locator('#options strong').allTextContents();
  expect(values.map(value => Number(value.split(' · ')[0])).reduce((a, b) => a + b, 0)).toBe(1000);
  await page.reload();
  await expect(page.locator('#round-output')).toHaveText('60 of 60');
  expect(await page.locator('#options strong').allTextContents()).toEqual(values);
});

test('Collective Mind uses its WebGPU renderer when available', async ({ page }) => {
  await page.goto('/world/collective-mind/');
  const available = await page.evaluate(async () => Boolean(await navigator.gpu?.requestAdapter()));
  test.skip(!available, 'This Chrome configuration has no WebGPU adapter.');
  await expect(page.locator('#backend')).toHaveText('WebGPU');
  await expect(page.locator('#network .network-gpu')).toBeVisible();
});
