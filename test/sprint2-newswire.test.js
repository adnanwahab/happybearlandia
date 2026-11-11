import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { canonicalId } from '../shared/causality/index.js';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { createWorldCausalAdapter } from '../world/causal/adapter.js';
import { createWorldCausalScenario } from '../world/causal/scenario.js';
import { contextFromURL } from '../world/universe/navigation.js';
import {
  CITYWIDE, UNMAPPED, buildNewswire, demoRunId, filterNewswire, listNewswireRuns, readNewswire,
} from '../world/sprint2/newswire.js';

test('Newswire reads saved runs and filters recorded stories with exact district, month and year context', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const handle = createCausalityHandler({ store });
  const reads = [];
  const fetcher = (path, options) => {
    const url = new URL(path, 'http://localhost');
    if (url.pathname.endsWith('/runs')) url.searchParams.set('limit', '1');
    if (url.pathname.endsWith('/events')) url.searchParams.set('limit', '17');
    reads.push(url);
    return handle(new Request(url, options));
  };

  expect(await listNewswireRuns({ fetcher })).toEqual([]);
  const recorded = await fetcher('/api/causality/world-scenario', { method: 'POST' });
  expect(recorded.status).toBe(200);

  const scenario = createWorldCausalScenario();
  const secondId = canonicalId('run', 'hbl', 'newswire-second');
  const context = { ...scenario.getContext(), runId: secondId };
  const second = createWorldCausalAdapter({ context, initialState: scenario.getState() });
  second.step();
  second.step();
  store.createRun({ context, metadata: { manifest: second.getManifest() } });
  const { events, observations, edges } = second.snapshot();
  store.commitStep(secondId, { expectedRevision: 0, events, observations, edges });
  store.completeRun(secondId, { expectedRevision: 1 });

  const runs = await listNewswireRuns({ fetcher });
  expect(runs.map(run => run.id).sort()).toEqual([demoRunId, secondId].sort());
  expect(reads.some(url => url.searchParams.has('afterId'))).toBe(true);
  const demo = runs.find(run => run.id === demoRunId);
  const archive = await readNewswire(demo, { fetcher });
  expect(archive.mappingIssue).toBe('');
  expect(archive.neighborhoods.map(row => row.name)).toEqual(['Center', 'Riverside', 'Uptown']);
  expect(archive.ticks).toContain(1);
  expect(archive.ticks).toContain(20);
  expect(reads.some(url => url.pathname.endsWith('/events') && url.searchParams.has('afterSequence'))).toBe(true);
  expect(reads.every(url => !url.pathname.endsWith('/observations'))).toBe(true);

  const riverside = archive.neighborhoods.find(row => row.name === 'Riverside').id;
  const filters = { neighborhood: riverside, month: '2', year: '1' };
  const flood = filterNewswire(archive.stories, filters).find(story => story.event.type === 'FLOOD_DAMAGE');
  expect(flood).toMatchObject({ neighborhoodName: 'Riverside', month: 2, year: 1 });
  expect(filterNewswire(archive.stories, { ...filters, year: '2' })).toEqual([]);
  expect(filterNewswire(archive.stories, { ...filters, month: '1' })).toEqual([]);
  expect(filterNewswire(archive.stories, { ...filters, neighborhood: CITYWIDE })).toEqual([]);
  expect(filterNewswire(archive.stories, { neighborhood: CITYWIDE, month: '12', year: '1' })
    .map(story => story.event.type)).toContain('ANNUAL_POPULATION_UPDATE');

  const source = new URL(flood.href, 'http://localhost');
  expect(source.pathname).toBe('/world/causality/inspect.html');
  expect(contextFromURL(source.href)).toMatchObject({
    universeId: demo.context.universeId, worldId: demo.context.worldId, scenarioId: demo.context.scenarioId,
    runId: demoRunId, tick: 2, entityId: riverside,
  });
  expect(source.searchParams.get('targetId')).toBe(flood.event.id);
  const explain = await fetcher('/api/causality/explain' + source.search);
  expect((await explain.json()).nodes).toContainEqual(flood.event);

  const alternate = await readNewswire(runs.find(run => run.id === secondId), { fetcher });
  expect(alternate.mappingIssue).toContain('no saved starting city checkpoint');
  const unmapped = filterNewswire(alternate.stories, { neighborhood: UNMAPPED });
  expect(unmapped.map(story => story.event.type)).toContain('FLOOD_DAMAGE');
  expect(alternate.stories.every(story => story.event.context.runId === secondId)).toBe(true);

  const mismatched = { ...flood.event, entityIds: [] };
  const inventory = archive.neighborhoods.map(({ localId, name }) => ({ id: localId, name }));
  expect(buildNewswire(demo, [mismatched], [], inventory).stories[0].neighborhoodId).toBe(UNMAPPED);
  expect(buildNewswire(demo, [], [], inventory).stories).toEqual([]);
}, 20000);
