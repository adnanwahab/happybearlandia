import {test, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';

// Every journey uses the real local City API. Interception delays requests only;
// it never fulfills requests or substitutes model responses.
const observations = new WeakMap();
test.beforeEach(async ({page}) => {
 const record = {pageErrors: [], consoleErrors: [], failedRequests: []};
 observations.set(page, record);
 page.on('pageerror', error => record.pageErrors.push(error.message));
 page.on('console', message => { if (message.type() === 'error') record.consoleErrors.push(message.text()); });
 page.on('requestfailed', request => record.failedRequests.push({url: request.url(), reason: request.failure()?.errorText}));
});
test.afterEach(async ({page}, info) => {
 const record = observations.get(page);
 await mkdir(info.outputDir, {recursive: true});
 await writeFile(info.outputPath('browser-log.json'), JSON.stringify({...record, route: page.url(), viewport: page.viewportSize(), status: info.status}, null, 2));
 expect(record.pageErrors).toEqual([]);
 if (!info.title.includes('network failure')) expect(record.consoleErrors).toEqual([]);
});

const route = '/world/future-machine.html';
const ready = page => expect.poll(() => page.evaluate(() => window.futureMachine?.state.status), {timeout: 90000}).toBe('ready');
async function seek(page, month) {
 const slider = page.getByTestId('future-machine-timeline');
 await slider.fill(String(month));
 await slider.dispatchEvent('input');
 await expect.poll(() => page.evaluate(() => window.futureMachine.state.month)).toBe(month);
}
async function capture(page, info, label) {
 const directory = info.outputPath(label);
 await mkdir(directory, {recursive: true});
 const record = await page.evaluate(() => {
  const {history: h, state: s, stats} = window.futureMachine;
  let first = null;
  for (let month = 1; month < h.plan.length; month++) {
   const added = h.plan[month].state.buildings.find(b => !h.baseline[month].state.buildings.some(a => a.id === b.id));
   if (added) { first = {month, collection: 'buildings', id: added.id}; break; }
  }
  return {
   scenario: {modelVersion: h.modelVersion, recipe: h.recipe, seed: h.seed,
    experimentId: h.experimentId, initialHash: h.initialHash, intervention: h.recipe.intervention,
    route: location.href, backend: stats.scene.backend, viewport: {width: innerWidth, height: innerHeight},
    browser: navigator.userAgent, provenance: h.provenance},
   metrics: {month: s.month, metrics: s.diff.metrics, firstChangedEntity: first},
   sameInitial: JSON.stringify(h.baseline[0].state) === JSON.stringify(h.plan[0].state),
   lengths: [h.baseline.length, h.plan.length], scene: stats.scene,
  };
 });
 for (const name of ['scenario', 'metrics']) await writeFile(`${directory}/${name}.json`, JSON.stringify(record[name], null, 2));
 await page.screenshot({path: `${directory}/${label}.png`, fullPage: true});
 return record;
}
async function clickRecordedBuilding(page, entity) {
 await page.getByRole('button', {name: 'Side by side', exact: true}).click();
 const canvas = page.locator('canvas').first();
 await canvas.scrollIntoViewIfNeeded();
 const target = await page.evaluate(async ({id, collection}) => {
  const {history: h, state: s, stats} = window.futureMachine;
  if (stats.scene.backend !== 'canvas2d') return stats.scene.targets.find(t => t.id === id && t.collection === collection && t.arm === 'plan' && !t.ghost);
  // Canvas does not publish mesh targets. Use the renderer's public mapping and
  // camera to project the actual recorded entity, including history-stable slots.
  const {createSpatialMapping} = await import('/world/future-machine/scene/mapping.js');
  const {canvasPoint, canvasViewports} = await import('/world/future-machine/scene/canvas-stage.js');
  const mapping = createSpatialMapping();
  for (let month = 0; month <= 120; month++) mapping.frame(h.baseline[month].state, h.plan[month].state);
  const row = mapping.frame(h.baseline[s.month].state, h.plan[s.month].state).b.find(r => r.id === id && r.collection === collection);
  if (!row) return null;
  const bounds = document.querySelector('canvas').getBoundingClientRect();
  return canvasPoint(row.x, row.z, stats.scene.camera, canvasViewports(bounds.width, bounds.height, 'split')[1]);
 }, entity);
 expect(target, 'The recorded added building must be clickable').toBeTruthy();
 const box = await canvas.boundingBox();
 await page.mouse.click(box.x + target.x, box.y + target.y);
}
async function inspectPair(page, info) {
 await seek(page, 0);
 const start = await capture(page, info, 'month-0');
 expect(start.sameInitial).toBe(true);
 expect(start.lengths).toEqual([121, 121]);
 expect(start.scenario.seed).toBe(42);
 expect(start.scenario.initialHash).toBeTruthy();
 expect(Object.values(start.metrics.metrics).every(metric => metric.delta === 0)).toBe(true);
 await seek(page, 120);
 const end = await capture(page, info, 'month-120');
 expect(end.metrics.metrics.housingUnits).toMatchObject({delta: 24, unit: 'homes'});
 const first = end.metrics.firstChangedEntity;
 expect(first).toBeTruthy();
 await seek(page, first.month);
 await capture(page, info, 'first-divergence');
 await clickRecordedBuilding(page, first);
 const story = page.getByRole('region', {name: 'Recorded change story'});
 await expect(story).toContainText(first.id);
 await expect(story).toContainText('PROJECT_COMPLETE');
 // Preserve the separate metric WHY contract, including its exact run context.
 await page.getByRole('button', {name: 'WHY · Homes', exact: true}).click();
 for (const value of [String(first.month), String(start.scenario.seed), start.scenario.modelVersion, start.scenario.experimentId]) await expect(story).toContainText(value);
 await capture(page, info, 'why-open');
 await seek(page, 0);
 expect(await page.evaluate(() => window.futureMachine.state.diff.physicalCount)).toBe(0);
 return {start, end};
}

test('record real SHE-71 homepage journey and intervention replay', async ({page}, info) => {
 let release;
 const gate = new Promise(resolve => release = resolve);
 await page.route('**/api/city-experiments', async request => { await gate; await request.continue(); });
 await page.goto('/');
 const started = Date.now();
 await page.getByRole('link', {name: 'Play Demo', exact: true}).click();
 await expect(page).toHaveURL(/\/world\/future-machine.html/);
 try {
  await expect(page.getByTestId('future-machine-timeline')).toBeDisabled();
  await expect(page.locator('.fm-status')).toContainText(/running|creating|loading/i);
 } finally { release(); }
 await ready(page);
 await page.unroute('**/api/city-experiments');
 // Manual timeline input stops the director. Let the full presentation finish
 // before scrubbing evidence frames; a stopped demo cannot be resumed.
 await expect.poll(() => page.evaluate(() => window.futureMachine.state.demo.status), {timeout: 70000}).toBe('complete');
 await writeFile(info.outputPath('timing.json'), JSON.stringify({elapsedMs: Date.now() - started, presentationElapsedMs: await page.evaluate(() => window.futureMachine.state.demo.elapsedMs)}, null, 2));
 const {start, end} = await inspectPair(page, info);
 await page.getByRole('combobox', {name: 'Plan', exact: true}).selectOption('baseline');
 await page.getByRole('button', {name: 'Fork City', exact: true}).click();
 await ready(page); await seek(page, 120);
 const zero = await capture(page, info, 'no-intervention');
 expect(zero.scenario.intervention).toBeNull();
 expect(Object.values(zero.metrics.metrics).every(metric => metric.delta === 0)).toBe(true);
 expect(await page.evaluate(() => window.futureMachine.state.diff.changedCount)).toBe(0);
 await page.getByRole('combobox', {name: 'Plan', exact: true}).selectOption('housing');
 await page.getByRole('button', {name: 'Fork City', exact: true}).click();
 await ready(page); await seek(page, 120);
 const rerun = await capture(page, info, 'rerun');
 expect(rerun.metrics).toEqual(end.metrics);
 expect(rerun.scenario.initialHash).toBe(start.scenario.initialHash);
 expect(rerun.scenario.experimentId).not.toBe(start.scenario.experimentId);
});

for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) test(`SHE-71 Canvas2D click scrub and controls ${viewport.width}`, async ({page}, info) => {
 await page.setViewportSize(viewport);
 await page.goto(route + '?renderer=canvas2d');
 await page.getByRole('button', {name: 'Fork City', exact: true}).click();
 await ready(page);
 await expect.poll(() => page.evaluate(() => window.futureMachine.stats.scene.backend)).toBe('canvas2d');
 await inspectPair(page, info);
 await seek(page, 120); await capture(page, info, 'canvas2d'); await seek(page, 0);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 for (const control of [page.getByTestId('future-machine-timeline'), page.getByRole('button', {name: 'WHY · Homes', exact: true}), page.getByRole('button', {name: 'Fork City', exact: true})]) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport();
  expect(await control.evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit); })).toBe(true);
 }
});

test('SHE-71 actual network failure, loading explanation and retry', async ({page, context}, info) => {
 await page.goto(route + '?renderer=canvas2d');
 let release, reached;
 const requestSeen = new Promise(resolve => reached = resolve);
 const gate = new Promise(resolve => release = resolve);
 await page.route('**/api/city-experiments', async request => { reached(); await gate; await request.continue(); });
 await page.getByRole('button', {name: 'Fork City', exact: true}).click();
 try {
  await expect(page.getByRole('button', {name: 'Fork City', exact: true})).toBeDisabled();
  await expect(page.getByTestId('future-machine-seed')).toBeDisabled();
  await expect(page.getByTestId('future-machine-timeline')).toBeDisabled();
  await expect(page.locator('.fm-status')).toContainText(/running|creating|loading/i);
  await requestSeen;
  await context.setOffline(true);
 } finally { release(); }
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByRole('button', {name: 'Fork City', exact: true})).toBeEnabled();
 await page.screenshot({path: info.outputPath('offline.png'), fullPage: true});
 await context.setOffline(false);
 await page.unroute('**/api/city-experiments');
 await page.getByRole('button', {name: 'Fork City', exact: true}).click();
 await ready(page);
 await capture(page, info, 'recovered');
});
