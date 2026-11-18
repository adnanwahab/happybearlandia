import { expect, test } from '@playwright/test';

const routes = [
  ['Saved Futures Library', 'futures'],
  ['Two-Month Delta Explorer', 'delta'],
  ['100-Future Outcome Histogram', 'histogram'],
  ['Bakery Evidence Export', 'bakery-export', 'Bakery evidence'],
  ['Causal Evidence Coverage', 'coverage'],
  ['Neighborhood Newswire', 'newswire'],
];

test('homepage links open all six sprint tools', async ({ page }, testInfo) => {
  // The separate gallery previews can start WebGPU apps while this test checks navigation.
  await page.route('**/*', route => {
    const request = route.request();
    return request.isNavigationRequest() && request.frame().parentFrame()
      ? route.abort()
      : route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Explore' })
    .getByRole('link', { name: 'Evidence & Futures' }).click();
  const section = page.getByRole('region', { name: 'Evidence & Futures' });
  await expect(section.getByRole('link')).toHaveCount(routes.length);
  await section.screenshot({ path: testInfo.outputPath('homepage.png') });
  for (const [label, route, heading = label] of routes) {
    await expect(section.getByRole('link', { name: label, exact: true }))
      .toHaveAttribute('href', `/world/sprint2/${route}.html`);
    await section.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page.goBack({ waitUntil: 'domcontentloaded' });
  }
});

test('saved futures, coverage, and newswire share the recorded city demo', async ({ page, request }, testInfo) => {
  const recorded = await request.post('/api/causality/world-scenario');
  expect(recorded.ok()).toBe(true);
  const { context: { runId } } = await recorded.json();

  await page.goto('/world/sprint2/futures.html');
  await expect(page.getByRole('status')).toHaveText('1 saved run');
  await page.getByLabel('Open at month').selectOption('2');
  const history = page.getByRole('link', { name: 'Open history' });
  const historyUrl = new URL(await history.getAttribute('href'), page.url());
  expect(historyUrl.pathname).toBe('/world/causal.html');
  expect(historyUrl.searchParams.get('runId')).toBe(runId);
  expect(historyUrl.searchParams.get('month')).toBe('2');
  await page.screenshot({ path: testInfo.outputPath('saved-futures.png') });
  await history.click();
  await expect(page).toHaveURL(url => url.pathname === historyUrl.pathname
    && url.searchParams.get('runId') === runId && url.searchParams.get('month') === '2');
  await expect(page.locator('#checkpoint')).toContainText('Stored month 2');

  await page.goto('/world/sprint2/coverage.html');
  await expect(page.locator('#run option').filter({ hasText: runId })).toHaveCount(1);
  await page.locator('#run').selectOption(runId);
  await page.getByRole('button', { name: 'Load coverage' }).click();
  await expect(page.locator('#status')).toHaveText('Coverage loaded.');
  await expect(page.getByRole('rowheader', { name: 'All records' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('coverage.png') });

  await page.goto('/world/sprint2/newswire.html');
  await expect(page.getByLabel('Recorded run')).toHaveValue(runId);
  await page.getByLabel('Neighborhood').selectOption({ label: 'Riverside (d1)' });
  await page.getByRole('combobox', { name: 'Month', exact: true }).selectOption('2');
  await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('1');
  const flood = page.getByRole('article').filter({ has: page.locator('details p').filter({ hasText: 'FLOOD_DAMAGE' }) });
  await expect(flood.getByText(/Simulation narrative/)).toBeVisible();
  await flood.getByText('Recorded event data').click();
  await expect(flood.getByText(/FLOOD_DAMAGE/)).toBeVisible();
  await expect(flood.getByRole('link')).toHaveAttribute('href', /targetId=.+/);
  await page.screenshot({ path: testInfo.outputPath('newswire.png') });
});
