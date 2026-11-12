import { test, expect } from '@playwright/test';

test('record, scrub, inspect and reopen a stored city month', async ({ page }) => {
  test.setTimeout(45000);
  let writes = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/causality/world-scenario')) writes++;
  });
  await page.goto('/world/causal.html?source=worldline');
  const record = page.getByRole('button', { name: 'Record deterministic scenario' });
  await expect(page.getByText('Record the scenario to create the first set of checkpoints.')).toBeVisible();
  await page.getByRole('link', { name: 'Living Newspaper' }).click();
  await expect(page.getByRole('status')).toContainText('no saved run here');
  await page.goBack();
  await record.click();
  await expect(page.getByText('Stored month 0 · starting state')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'District heatmap' })).toBeVisible();
  const heatmapMetric = page.locator('#heatmap').getByRole('combobox', { name: 'Metric' });
  await heatmapMetric.selectOption({ label: 'Occupied share of all housing units' });
  const slider = page.getByRole('slider', { name: 'Simulation month' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Stored month 1 · changes since month 0')).toBeVisible();
  await expect(heatmapMetric.locator('option:checked')).toHaveText('Occupied share of all housing units');
  const historicalNetwork = page.getByText('Explore this month’s network', { exact: true });
  await historicalNetwork.click();
  const network = page.locator('#historical-network');
  await network.getByRole('button', { name: /Road commute demand/ }).first().click();
  await expect(network).toContainText('Individual trip records unavailable');
  await historicalNetwork.click();
  await expect(page.getByRole('button', { name: /worker-1 · Changed/ })).toBeVisible();
  await page.getByRole('button', { name: /worker-1 · Changed/ }).click();
  await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  const events = page.getByRole('combobox', { name: 'Jump to an event' });
  const completion = await events.locator('option').filter({ hasText: /· project completed$/ }).first().textContent();
  const month = Number(completion.match(/Month (\d+)/)[1]);
  await events.selectOption({ label: completion });
  await expect(slider).toHaveValue(String(month));
  const newBuilding = page.getByRole('button', { name: /building-.* · Added.*Construction evidence available/ });
  await expect(newBuilding).toBeVisible();
  await newBuilding.click();
  await expect(newBuilding).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'PROJECT_COMPLETED', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'MODEL_INPUTS', exact: true })).toBeVisible();
  const url = page.url();
  expect(new URL(url).searchParams.get('source')).toBe('worldline');
  expect(new URL(url).searchParams.get('event')).toBeTruthy();
  await page.reload();
  await expect(slider).toHaveValue(String(month));
  await expect(page.getByRole('heading', { name: 'PROJECT_COMPLETED', exact: true })).toBeVisible();
  await expect(newBuilding).toHaveAttribute('aria-pressed', 'true');
  expect(writes).toBe(1);

  await page.route('**/api/causality/state?**', async route => {
    if (new URL(route.request().url()).searchParams.get('tick') === '20') {
      await route.fulfill({ status: 404, json: { message: 'Checkpoint unavailable' } });
      return;
    }
    await route.continue();
  });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(page.getByText('Could not open month 20. Checkpoint unavailable')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Buildings', exact: true })).toHaveCount(0);
  await page.unroute('**/api/causality/state?**');
  await page.getByRole('button', { name: 'Retry checkpoint' }).click();
  await expect(page.getByText('Stored month 20 · changes since month 19')).toBeVisible();

  await page.getByRole('link', { name: 'Living Newspaper' }).click();
  await expect(page.getByRole('heading', { name: 'The Living Newspaper' })).toBeVisible();
  await expect(page.locator('header img')).toHaveJSProperty('complete', true);
  expect(await page.locator('header img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const headline = page.getByRole('link', { name: 'Jump to month' }).first();
  const headlineURL = new URL(await headline.getAttribute('href'), page.url());
  await headline.click();
  await expect(slider).toHaveValue(headlineURL.searchParams.get('month'));
  await expect(page.getByText('Recorded model dependencies;', { exact: false })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Open recorded event' }).first().click();
  await expect(page.getByText('Recorded model dependencies;', { exact: false })).toBeVisible();

  await page.goto('/world/causal.html');
  await page.getByRole('link', { name: 'Surprising discoveries' }).click();
  await expect(page.getByRole('status')).toContainText('Analyzed');
  await expect(page.getByRole('region', { name: 'Discovery results' })).toBeVisible();
  const firstFinding = page.locator('#findings > li').first();
  await firstFinding.getByText('Recorded evidence', { exact: true }).click();
  await firstFinding.getByRole('link').first().click();
  await expect(page.getByText('Recorded model dependencies;', { exact: false })).toBeVisible();
});

test('play stored months, pause for inspection, and stop at the recorded endpoint', async ({ page }) => {
  const response = await page.request.post('/api/causality/world-scenario');
  expect(response.ok()).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1500));
  await page.goto('/world/causal.html?source=playback-test');
  await expect(page.locator('#checkpoint')).toContainText('Stored month 0');
  const play = page.getByRole('button', { name: 'Play', exact: true });
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  const slider = page.getByRole('slider', { name: 'Simulation month' });
  const nextEvent = page.getByRole('button', { name: 'Next recorded event' });
  const changes = page.getByRole('group', { name: 'Month-to-month entity changes' });
  await expect(changes).toContainText('require a preceding stored month');
  await page.clock.runFor(1200);
  await expect(slider).toHaveValue('0');

  await play.click();
  await page.clock.runFor(1000);
  await expect(page.locator('#checkpoint')).toContainText('Stored month 1');
  await pause.click();
  await page.clock.runFor(1200);
  await expect(slider).toHaveValue('1');
  await expect(play).toBeEnabled();
  const shown = await page.locator('#inventory button.changed strong').allTextContents();
  for (const kind of ['Added', 'Changed', 'Removed']) {
    await expect(changes.locator('#change-' + kind.toLowerCase())).toHaveText(
      String(shown.filter(label => label.endsWith(' · ' + kind)).length),
    );
  }

  await nextEvent.click();
  await expect(page.locator('#checkpoint')).toContainText('Stored month 2');
  expect(new URL(page.url()).searchParams.get('event')).toBeTruthy();

  const speed = page.getByRole('combobox', { name: 'Playback speed' });
  await speed.selectOption('4');
  const requested = [];
  let startRequest, releaseRequest;
  const started = new Promise(resolve => { startRequest = resolve; });
  const release = new Promise(resolve => { releaseRequest = resolve; });
  await page.route('**/api/causality/state?**', async route => {
    const tick = Number(new URL(route.request().url()).searchParams.get('tick'));
    requested.push(tick);
    if (tick === 3) {
      startRequest();
      await release;
    }
    await route.continue();
  });
  try {
    await play.click();
    await page.clock.runFor(250);
    await started;
    await slider.fill('18');
    await expect(page.locator('#checkpoint')).toContainText('Loading stored month 18');
    expect(requested).toEqual([3]);
  } finally {
    releaseRequest();
  }
  await expect(page.locator('#checkpoint')).toContainText('Stored month 18');
  expect(requested).toEqual([3, 18, 17]);
  await page.unroute('**/api/causality/state?**');
  await expect(play).toBeEnabled();
  await page.clock.runFor(1000);
  await expect(slider).toHaveValue('18');
  await play.click();
  await page.clock.runFor(250);
  await expect(page.locator('#checkpoint')).toContainText('Stored month 19');
  await page.clock.runFor(250);
  await expect(page.locator('#checkpoint')).toContainText('Stored month 20');
  await expect(page.getByText('Playback finished at month 20.')).toBeVisible();
  await expect(play).toBeDisabled();
  await page.reload();
  await expect(slider).toHaveValue('20');
  await expect(page.locator('#checkpoint')).toContainText('Stored month 20');
  expect(new URL(page.url()).searchParams.get('source')).toBe('playback-test');
});

test('switch to a sparse saved run and reopen its exact checkpoint', async ({ page }) => {
  const { canonicalId } = await import('../../shared/causality/index.js');
  const { VERSION } = await import('../../world/city/contracts.js');
  const { createCity } = await import('../../world/city/seed.js');
  const runId = canonicalId('run', 'test', 'another-city');
  const context = {
    universeId: canonicalId('universe', 'test', 'universe'),
    worldId: canonicalId('world', 'test', 'another-city'),
    scenarioId: canonicalId('scenario', 'test', 'scenario'),
    runId,
    seed: 123,
    modelVersion: VERSION,
    tick: 7,
  };
  const checkpoints = [7, 9].map(tick => ({
    id: canonicalId('checkpoint', 'test', `recorded-${tick}`),
    domain: 'world-city',
    modelVersion: VERSION,
    adapterVersion: 'city-replay.v1',
    tick,
  }));
  const state = createCity({ seed: context.seed, households: 2 });
  const requested = [];
  await page.route('**/api/causality/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/runs')) {
      const response = await route.fetch();
      const { items, nextCursor } = await response.json();
      return route.fulfill({ json: {
        items: [...items, { id: runId, status: 'completed', context }], nextCursor,
      } });
    }
    if (url.searchParams.get('runId') === runId) {
      return route.fulfill({ json: {
        items: url.pathname.endsWith('/checkpoints') ? checkpoints : [], nextCursor: null,
      } });
    }
    const scopedContext = JSON.parse(url.searchParams.get('context') ?? 'null');
    if (url.pathname.endsWith('/state') && scopedContext?.runId === runId) {
      const tick = Number(url.searchParams.get('tick'));
      const id = url.searchParams.get('checkpointId');
      requested.push({ tick, id });
      return route.fulfill({ json: {
        context: scopedContext,
        targetTick: tick,
        checkpoint: checkpoints.find(row => row.tick === tick && row.id === id),
        state: { ...state, month: tick },
      } });
    }
    await route.continue();
  });
  await page.goto('/world/causal.html?source=worldline');
  const savedRun = page.getByRole('combobox', { name: 'Saved city run' });
  await savedRun.selectOption(runId);
  await expect(page.getByText('Stored month 7 · starting state')).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Simulation month' });
  await expect(slider).toHaveAttribute('min', '7');
  await expect(slider).toHaveAttribute('max', '9');
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('4');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText('Could not open month 8. No stored checkpoint is available for this month.')).toBeVisible();
  await expect(page.getByText('Playback stopped at month 8.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await slider.focus();
  await page.keyboard.press('End');
  await expect(page.getByText('Stored month 9', { exact: true })).toBeVisible();
  expect(requested).toEqual(checkpoints.map(({ tick, id }) => ({ tick, id })));

  await page.reload();
  await expect(savedRun).toHaveValue(runId);
  await expect(slider).toHaveValue('9');
  await expect(page.getByText('Stored month 9', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('source')).toBe('worldline');
});
