import { expect, test } from '@playwright/test';

test('the deployed revision has a known build ID and ready storage', async ({ request }) => {
  const revision = process.env.HBL_SMOKE_BUILD_ID;
  expect(revision).toMatch(/^[a-f0-9]{7,64}$/);
  for (const [path, status] of [['/api/health', 'ok'], ['/api/ready', 'ready']]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const report = await response.json();
    expect(report.buildId, `${path} must identify the deployed commit; supply HBL_BUILD_ID at build time`).toMatch(/^[a-f0-9]{7,64}$/);
    expect(report).toMatchObject({ status, buildId: revision });
    if (path === '/api/ready') {
      expect(report.checks).toMatchObject({ worldStorage: 'ok', decisionStorage: 'ok' });
    }
  }
});

test('the deployed revision serves working release entry points', async ({ page, request }) => {
  const revision = process.env.HBL_SMOKE_BUILD_ID;
  expect(revision).toMatch(/^[a-f0-9]{7,64}$/);
  const faults = [];
  page.on('pageerror', error => faults.push(error.message));
  // Smoke the deployed entry points without loading unrelated embedded previews.
  await page.route('**/*', route => {
    if (route.request().resourceType() === 'document' && route.request().frame().parentFrame()) return route.abort();
    return route.continue();
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Try Today’s Features', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Worldline · Saved Future Journey' })).toBeVisible();
  await page.goto('/tools/simulation-health');
  await expect(page.getByText(revision, { exact: true })).toBeVisible();
  const expectedRoutes = ['/world/causal.html', '/world/living-city/', '/world/journeys/bakery.html',
    '/world/newspaper/', '/world/discoveries/', '/world/causality/inspect.html'];
  for (const path of expectedRoutes) expect((await request.get(path)).status(), path).toBe(200);
  expect(faults).toEqual([]);
});
