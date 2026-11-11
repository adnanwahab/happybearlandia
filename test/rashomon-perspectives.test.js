import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { demoCheckpointId, demoRunId } from '../world/causal/demo.js';
import { loadPerspectives, RULES_VERSION } from '../world/civilization/perspectives/model.js';

const origin = 'http://localhost';

test('four resident perspectives use the same stored flood and exact checkpoints', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const handle = createCausalityHandler({ store });
  const requests = [];
  const read = async path => {
    const url = new URL(path, origin);
    if (url.pathname.endsWith('/events')) url.searchParams.set('limit', '35');
    requests.push(url);
    return handle(new Request(url));
  };

  expect(await loadPerspectives(read)).toEqual({ state: 'missing' });
  expect(requests).toHaveLength(1);
  const setup = await handle(new Request(origin + '/api/causality/world-scenario', { method: 'POST' }));
  expect(setup.status).toBe(200);
  const revision = store.getRun(demoRunId).revision;

  const result = await loadPerspectives(read);
  expect(result.state).toBe('ready');
  const { report } = result;
  expect(report).toMatchObject({ month: 2, district: 'Riverside', affectedUnits: 7, seed: 2911, rulesVersion: RULES_VERSION });
  expect(requests.some(url => url.searchParams.has('afterSequence'))).toBe(true);
  const checkpoints = requests.filter(url => url.pathname.endsWith('/state'));
  expect(checkpoints.map(url => url.searchParams.get('checkpointId')))
    .toEqual([demoCheckpointId(demoRunId, 1), demoCheckpointId(demoRunId, 2)]);

  const [rehoused, unhoused, commute, distant] = report.perspectives;
  expect(new Set(report.perspectives.map(row => row.household)).size).toBe(4);
  expect(rehoused.priorUnitStatus).toBe('under renovation');
  expect(rehoused.after.unitId).toBeTruthy();
  expect(rehoused.after.unitId).not.toBe(rehoused.before.unitId);
  expect(unhoused.priorUnitStatus).toBe('under renovation');
  expect(unhoused.after.unitId).toBeNull();
  expect(distant.before.district).not.toBe(report.district);
  expect(distant.after).toEqual(distant.before);
  expect(new URL(commute.afterLink, origin).searchParams.get('inspectEntity')).toMatch(/^person:world-city:/);
  const replay = new URL(report.replayLink, origin);
  expect(replay.searchParams.get('month')).toBe('2');

  for (const [link, type] of [[report.evidenceLink, 'FLOOD_DAMAGE'], [commute.routeEvidence, 'UNREACHABLE_JOB']]) {
    const evidence = new URL(link, origin);
    expect(evidence.pathname).toBe('/world/causality/inspect.html');
    expect(evidence.searchParams.get('tick')).toBe('2');
    const response = await read('/api/causality/explain?' + evidence.searchParams);
    const id = evidence.searchParams.get('targetId');
    expect((await response.json()).nodes.find(node => node.id === id)?.type).toBe(type);
  }

  expect(await loadPerspectives(read)).toEqual(result);
  expect(store.getRun(demoRunId).revision).toBe(revision);

  const missingCheckpoint = path => path.startsWith('/api/causality/state?')
    ? new Response(null, { status: 404 })
    : read(path);
  await expect(loadPerspectives(missingCheckpoint)).rejects.toThrow('Stored state could not be read');
}, 20000);

test('incomplete runs and completed runs without flood events produce explicit empty states', async () => {
  const context = { runId: demoRunId, modelVersion: 'city-systems.1.0.0' };
  const fetcher = status => async path => {
    if (path.startsWith('/api/causality/run?')) return Response.json({ run: { context, status } });
    if (path.startsWith('/api/causality/events?')) return Response.json({ items: [], nextCursor: null });
    throw new Error('Unexpected request: ' + path);
  };
  expect(await loadPerspectives(fetcher('running'))).toEqual({ state: 'incomplete' });
  expect(await loadPerspectives(fetcher('completed'))).toEqual({ state: 'no-event' });
});
