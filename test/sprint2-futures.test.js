import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { resolve, sep } from 'node:path';
import { causalContentHash, createCausalStore } from '../shared/causality/storage.js';
import { demoCheckpointId, demoLastMonth, demoRunId } from '../world/causal/demo.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { VERSION } from '../world/city/contracts.js';
import { createEngine } from '../world/city/engine.js';
import { createCity } from '../world/city/seed.js';
import { createCityReplayAdapter } from '../world/replay/city-adapter.js';
import { createReplayCheckpoint } from '../world/replay/engine.js';
import { createSavedFuturesHandler } from '../world/sprint2/futures-api.js';

const api = '/api/causality/';
const branchId = 'run:test:public-branch';
const privateId = 'run:test:private-city';
const runningId = 'run:test:running-city';
const emptyId = 'run:test:no-checkpoints';

function setup(publicRunIds) {
  const db = new Database(':memory:');
  const store = createCausalStore(db);
  const handle = createCausalityHandler({
    store, extensions: [createSavedFuturesHandler({ store, publicRunIds })],
  });
  const request = (path, options) => handle(new Request('http://localhost' + api + path, options));
  return { db, store, handle, request };
}

async function saveCity(store, runId, { seed, parent, months = [0, 3], complete = true }) {
  const context = { ...parent.context, runId, parentRunId: parent.id, seed };
  const adapter = createCityReplayAdapter();
  const engine = createEngine();
  let state = createCity({ seed, households: 18 });
  store.createRun({ context, metadata: { manifest: { domain: 'world-city', note: 'internal metadata' } } });
  const checkpoints = [];
  for (const month of months) {
    while (state.month < month) state = engine.step(state).state;
    const id = demoCheckpointId(runId, month);
    const scope = { ...context, tick: month };
    const checkpoint = await createReplayCheckpoint({ id, context: scope, tick: month, adapter, state });
    checkpoints.push({ id, context: scope, sequence: month, state: checkpoint,
      hash: causalContentHash(checkpoint), replayMode: 'recorded' });
  }
  if (checkpoints.length) store.commitStep(runId, { expectedRevision: 0, checkpoints });
  if (complete) store.completeRun(runId, { expectedRevision: Number(checkpoints.length > 0) });
}

test('catalog reads completed approved city checkpoints and preserves other stored runs', async () => {
  const { db, store, request } = setup([demoRunId, branchId, runningId, emptyId, branchId]);
  try {
    expect(await (await request('saved-futures')).json()).toEqual({ items: [] });
    expect((await request('saved-futures', { method: 'POST' })).status).toBe(405);
    expect((await request('world-scenario', { method: 'POST' })).ok).toBe(true);
    const parent = store.getRun(demoRunId);
    await saveCity(store, branchId, { seed: 17, parent });
    await saveCity(store, privateId, { seed: 18, parent });
    await saveCity(store, runningId, { seed: 19, parent, complete: false });
    await saveCity(store, emptyId, { seed: 20, parent, months: [] });
    const before = store.getRun(privateId);

    const catalog = await request('saved-futures?' + new URLSearchParams({ runId: privateId }));
    expect(catalog.headers.get('cache-control')).toBe('no-store');
    expect(await catalog.json()).toEqual({ items: [
      { id: demoRunId, seed: 2911, modelVersion: VERSION, kind: 'Demo',
        months: Array.from({ length: demoLastMonth + 1 }, (_, month) => month) },
      { id: branchId, seed: 17, modelVersion: VERSION, kind: 'Branch', months: [0, 3] },
    ] });
    const defaultResponse = createSavedFuturesHandler({ store })(new Request('http://localhost' + api + 'saved-futures'));
    expect((await defaultResponse.json()).items.map(run => run.id)).toEqual([demoRunId]);
    expect(store.getRun(privateId)).toEqual(before);
    expect(store.listCheckpoints(privateId).items).toHaveLength(2);

    const context = store.getRun(branchId).context;
    const query = new URLSearchParams({ context: JSON.stringify({ ...context, tick: 3 }),
      tick: '3', checkpointId: demoCheckpointId(branchId, 3) });
    const replay = await (await request('state?' + query)).json();
    expect(replay.state.month).toBe(3);
    expect(replay.state.seed).toBe(17);
  } finally {
    db.close();
  }
}, 15_000);

if (process.env.HBL_FUTURES_BROWSER === '1') {
  test('browser filters recorded runs and opens the selected saved month in Time Machine', async () => {
    const { chromium } = await import('playwright');
    const { expect: browserExpect } = await import('@playwright/test');
    const { db, store, request, handle } = setup([demoRunId, branchId]);
    const root = resolve(import.meta.dir, '..');
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(req) {
        if (new URL(req.url).pathname.startsWith(api)) return handle(req);
        const path = resolve(root, '.' + new URL(req.url).pathname);
        if (!path.startsWith(root + sep)) return new Response(null, { status: 404 });
        const file = Bun.file(path);
        return await file.exists() ? new Response(file) : new Response(null, { status: 404 });
      },
    });
    let browser;
    try {
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.setDefaultTimeout(5_000);
      const library = new URL('/world/sprint2/futures.html', server.url).href;
      await page.goto(library);
      await browserExpect(page.getByRole('status')).toHaveText('No public city runs have been recorded yet.');
      expect((await request('world-scenario', { method: 'POST' })).ok).toBe(true);
      const parent = store.getRun(demoRunId);
      await saveCity(store, branchId, { seed: 17, parent });
      await saveCity(store, privateId, { seed: 18, parent });

      await page.reload();
      await browserExpect(page.getByRole('status')).toHaveText('2 saved runs');
      await browserExpect(page.getByText(privateId)).toHaveCount(0);
      const demo = page.getByRole('listitem').filter({ hasText: 'Deterministic demo' });
      await demo.getByLabel('Open at month').selectOption('7');
      await browserExpect(demo.getByRole('link', { name: 'Open history' })).toHaveAttribute(
        'href', '/world/causal.html?' + new URLSearchParams({ runId: demoRunId, month: '7' }),
      );
      await page.getByLabel('Seed').fill('18');
      await browserExpect(page.getByRole('status')).toHaveText('No saved runs match these filters.');
      await page.getByRole('button', { name: 'Clear filters' }).click();
      await browserExpect(page.getByRole('status')).toHaveText('2 saved runs');
      await page.getByLabel('Model').selectOption(VERSION);
      await page.getByLabel('Kind').selectOption('Branch');
      await browserExpect(page.getByRole('heading', { name: 'City branch' })).toBeVisible();
      await page.getByLabel('From month').fill('1');
      await page.getByLabel('Through month').fill('2');
      await browserExpect(page.getByRole('status')).toHaveText('No saved runs match these filters.');
      await page.getByLabel('Through month').fill('3');
      await browserExpect(page.getByLabel('Open at month').locator('option')).toHaveText(['3']);
      await page.getByRole('link', { name: 'Open history' }).click();
      await browserExpect(page.locator('#month-label')).toHaveText('Month 3');
      await browserExpect(page.locator('#checkpoint')).toHaveText('Stored month 3');
      expect(new URL(page.url()).searchParams.get('runId')).toBe(branchId);
    } finally {
      await browser?.close();
      await server.stop(true);
      db.close();
    }
  }, 45_000);
}
