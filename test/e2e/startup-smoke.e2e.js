import { test, expect } from '@playwright/test';

// Bound startup coverage; deeper simulation journeys remain in their own suites.
const routes = [
  { path: '/', nodes: ['h1', 'a.flagship-demo', '#explore'], links: [
    '/world', '/world/future-machine.html', '/tools/future-journey.html',
    '/tools/simulation-health', '/routes',
  ] },
  // Existing pinned synthetic mode avoids map-service dependencies and autoplay.
  { path: '/world?demo=1&people=30&quality=LOW', nodes: ['#view canvas', '#world-guide-button', '#top'], world: true },
  { path: '/world/future-machine.html', nodes: ['.fm-ui h1', '.fm-primary', '[data-testid="future-machine-timeline"]'], future: true },
  { path: '/tools/future-journey.html', nodes: ['h1', '#open', '#status'], journey: true },
  { path: '/tools/simulation-health', nodes: ['h1', '#live', '#ready'], health: true },
  { path: '/routes', nodes: ['h1', 'a[href="/world"]'] },
];

for (const route of routes) {
  test(`startup ${route.path}`, async ({ page }, info) => {
    const report = { path: route.path, status: null, nodes: {}, capabilities: [], errors: [] };
    page.on('pageerror', error => report.errors.push(error.message));
    // Home contains expensive unrelated previews. Only the top-level route is under test.
    await page.route('**/*', request => {
      if (request.request().resourceType() === 'document' && request.request().frame().parentFrame()) return request.abort();
      return request.continue();
    });
    try {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      report.status = response?.status() ?? null;
      expect(report.status, 'route HTTP status').toBe(200);
      expect(response.headers()['content-type']).toContain('text/html');
      for (const selector of route.nodes) {
        await expect(page.locator(selector).first(), selector).toBeVisible();
        report.nodes[selector] = 'visible';
      }
      for (const path of route.links || []) {
        await expect(page.locator(`a[href="${path}"]`).first(), `advertised target ${path}`).toBeAttached();
      }
      if (route.world) {
        await expect.poll(() => page.evaluate(() => Boolean(window.hblWorldStartup?.readyMs)), { message: 'World scene ready' }).toBe(true);
        report.startup = await page.evaluate(() => window.hblWorldStartup);
      }
      if (route.future) {
        await expect(page.getByRole('button', { name: 'Fork City', exact: true })).toBeEnabled();
        // No comparison is created by this read-only startup check. This reason is
        // a smoke-contract interpretation of the verified initial state, not UI copy.
        const timeline = page.getByTestId('future-machine-timeline');
        await expect(timeline).toBeDisabled();
        report.capabilities.push({ capability: 'comparison timeline', enabled: false,
          reason: 'No paired run yet; use Fork City to create recorded months.', source: 'verified initial-state contract' });
      }
      if (route.journey) {
        await expect(page.locator('#demo')).toBeEnabled();
      }
      if (route.health) {
        await expect(page.locator('#live')).toContainText('Available');
        await expect(page.locator('#ready')).toContainText('Ready');
      }
      // Preserve actual UI explanations, including described-by text, for diagnosis.
      report.disabledControls = await page.locator('button:disabled, input:disabled, select:disabled, [aria-disabled="true"]').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({
        name: n.getAttribute('aria-label') || n.textContent.trim() || n.id,
        reason: n.getAttribute('aria-description') || n.title || (n.getAttribute('aria-describedby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || 'No UI explanation provided; capability reason is unobserved',
      })));
      expect(report.errors, 'uncaught startup errors').toEqual([]);
    } catch (error) {
      report.failure = error.message;
      throw error;
    } finally {
      console.log(JSON.stringify(report));
      await info.attach('startup-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    }
  });
}
