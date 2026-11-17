import { test, expect } from '@playwright/test';
import {sameOriginRouteURL} from '../support/startup-route-link.js';

// Bound startup coverage; deeper simulation journeys remain in their own suites.
const routes = [
  { path: '/', nodes: ['h1', 'a.flagship-demo', '#explore'], openTools:true, links: [
    {path:'/world',card:'World',name:'Standalone ↗'},
    {path:'/world/future-machine.html',name:'Try the 60-second simulation'},
    {path:'/tools/future-journey.html',name:'Try Today’s Features'},
    {path:'/tools/simulation-health',name:'Simulation Health'},
    {path:'/routes',name:'Route directory →'},
  ] },
  // Existing pinned synthetic mode avoids map-service dependencies and autoplay.
  { path: '/world?demo=1&people=30&quality=LOW', nodes: ['#view canvas', '#launch-navigation', '#launch-playback'], world: true },
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
      if(route.openTools)await page.getByText('More worlds and tools',{exact:true}).click();
      report.links = {};
      for (const {path,name,card} of route.links || []) {
        // The universe shell adds navigation context to hrefs. Match the named
        // link's actual same-origin pathname, preserving its query and fragment.
        // World lives in its connected directory card; preview templates are
        // inert until selected and are not advertised navigation in the DOM.
        const scope=card?page.getByRole('article').filter({has:page.getByRole('heading',{name:card,exact:true})}):page;
        const link=scope.getByRole('link',{name,exact:true});
        await expect(link, `advertised link ${name}`).toBeAttached();
        await expect.poll(async()=>sameOriginRouteURL(await link.getAttribute('href'),page.url(),path),{message:`advertised target ${path}`}).not.toBeNull();
        report.links[path]=sameOriginRouteURL(await link.getAttribute('href'),page.url(),path);
      }
      if (route.world) {
        await expect.poll(() => page.evaluate(() => Boolean(window.hblWorldStartup?.readyMs)), { message: 'World scene ready' }).toBe(true);
        report.startup = await page.evaluate(() => window.hblWorldStartup);
        const tools=page.getByRole('button',{name:'More tools',exact:true});
        await expect(tools).toHaveAttribute('aria-expanded','false');
        await expect(page.locator('#top')).toBeHidden();
        await tools.click();
        await expect(tools).toHaveAttribute('aria-expanded','true');
        await expect(page.locator('#top')).toBeVisible();
        await expect(page.locator('#top')).toHaveAttribute('open','');
        report.nodes['#top']='visible after More tools';
        await page.keyboard.press('Escape');
        await expect(tools).toHaveAttribute('aria-expanded','false');
        await expect(page.locator('#top')).toBeHidden();
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
