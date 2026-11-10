import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { buildEditions, DEMO_RUN_ID, loadArchive } from '../world/newspaper/editions.js';
import { contextFromURL } from '../world/universe/navigation.js';

const origin = 'http://localhost';

test('the newspaper reads the actual demo, follows event cursors and links to exact inspector records', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const handle = createCausalityHandler({ store });
  const reads = [];
  const fetcher = async path => {
    const url = new URL(path, origin);
    reads.push(url);
    // Force page boundaries in the real endpoint so the test exercises cursor handling.
    if (url.pathname.endsWith('/events')) url.searchParams.set('limit', '40');
    return handle(new Request(url));
  };

  expect(await loadArchive(fetcher)).toEqual({ state: 'missing' });
  expect(reads.map(url => url.pathname)).toEqual(['/api/causality/run']);

  const recorded = await handle(new Request(origin + '/api/causality/world-scenario', { method: 'POST' }));
  expect(recorded.status).toBe(200);
  const { context } = await recorded.json();
  expect(context.runId).toBe(DEMO_RUN_ID);

  const archive = await loadArchive(fetcher);
  expect(archive.state).toBe('ready');
  expect(archive.run.context.seed).toBe(context.seed);
  expect(reads.filter(url => url.searchParams.has('afterSequence')).length).toBeGreaterThan(0);
  expect(archive.editions.map(edition => edition.year)).toEqual([2, 1]);

  const [latest, first] = archive.editions;
  const project = latest.stories[0];
  expect(project.event.type).toBe('PROJECT_COMPLETE');
  expect(first.stories.some(({ event }) => event.type === 'FLOOD_DAMAGE')).toBe(true);
  const stored = store.listEvents(context.runId, { limit: 1000 }).items;
  const selected = stored.filter(event => [
    'PROJECT_COMPLETE', 'FLOOD_DAMAGE', 'ANNUAL_POPULATION_UPDATE',
    'CONSTRUCTION_STARTED', 'BUSINESS_OPENED', 'BUSINESS_CLOSED',
  ].includes(event.type));
  expect([...latest.stories, ...first.stories].map(({ event }) => event.id).sort())
    .toEqual(selected.map(event => event.id).sort());
  expect(project.event.provenance.kind).toBe('simulated');
  expect(project.copy).toContain(String(project.event.payload.source.payload.projectId));

  const url = new URL(project.href, origin);
  expect(url.pathname).toBe('/world/causality/inspect.html');
  expect(contextFromURL(url.href)).toMatchObject({
    runId: context.runId,
    tick: project.event.context.tick,
    entityId: project.event.entityIds[0],
  });
  expect(url.searchParams.get('targetId')).toBe(project.event.id);
  const explain = await handle(new Request(new URL('/api/causality/explain?' + url.searchParams, origin)));
  expect(explain.status).toBe(200);
  expect((await explain.json()).nodes).toContainEqual(project.event);
}, 20000);

test('empty feeds, unselected events, incomplete runs and request failures remain distinct', async () => {
  expect(buildEditions([])).toEqual([]);
  expect(buildEditions([{ type: 'MODEL_INPUTS', sequence: 1, context: { tick: 12 } }]))
    .toEqual([{ year: 1, stories: [] }]);

  const run = { status: 'completed' };
  expect(await loadArchive(async path => path.includes('/run?')
    ? Response.json({ run })
    : Response.json({ items: [], nextCursor: null })))
    .toEqual({ state: 'ready', run, editions: [] });
  expect(await loadArchive(async () => Response.json({ run: { status: 'running' } })))
    .toEqual({ state: 'incomplete' });
  await expect(loadArchive(async () => new Response(null, { status: 503 })))
    .rejects.toThrow('Could not read the recorded run');
  await expect(loadArchive(async path => path.includes('/run?')
    ? Response.json({ run })
    : Response.json({ items: [], nextCursor: 0 })))
    .rejects.toThrow('invalid cursor');
});
