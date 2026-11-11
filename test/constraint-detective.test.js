import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { createWorldCausalAdapter } from '../world/causal/adapter.js';
import { demoRunId } from '../world/causal/demo.js';
import { createWorldCausalScenario } from '../world/causal/scenario.js';
import { classifyConstraint, constraintsAtMonth, loadConstraintRun } from '../world/laboratory/constraints/model.js';

const origin = 'http://localhost';

test('a recorded construction capacity limit keeps its exact reason and zero progress', () => {
  const scenario = createWorldCausalScenario();
  const state = scenario.getState();
  state.parameters.labor = 0;
  const city = createWorldCausalAdapter({
    context: scenario.snapshot().context,
    initialState: state,
  });
  for (let index = 0; index < 8; index++) city.step();
  const event = city.snapshot().events.find(event => event.type === 'CAPACITY_DELAY' &&
    event.payload.source?.payload.reason === 'labor');
  expect(event).toBeDefined();
  expect(classifyConstraint(event)).toMatchObject({
    category: 'construction', title: 'Labor capacity', reason: 'labor', progress: 0,
  });

  const unrecognized = structuredClone(event);
  unrecognized.payload.source.payload.reason = 'unsupported cause';
  delete unrecognized.payload.source.payload.progressFraction;
  expect(classifyConstraint(unrecognized)).toMatchObject({ category: 'unclassified', progress: null });
  const mismatch = structuredClone(event);
  mismatch.payload.source.simulationTime++;
  expect(classifyConstraint(mismatch)).toBeNull();
});

test('retained City events link back to evidence and missing months differ from zero matches', async () => {
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
  expect(await loadConstraintRun(demoRunId, read)).toEqual({ state: 'missing' });
  const setup = await handle(new Request(origin + '/api/causality/world-scenario', { method: 'POST' }));
  expect(setup.status).toBe(200);
  const revision = store.getRun(demoRunId).revision;

  const run = await loadConstraintRun(demoRunId, read);
  expect(run.state).toBe('ready');
  expect(requests.some(url => url.searchParams.has('afterSequence'))).toBe(true);
  expect(constraintsAtMonth(run, 0).findings).toEqual([]);
  expect(Object.values(constraintsAtMonth(run, 0).counts).every(count => count === 0)).toBe(true);
  expect(constraintsAtMonth(run, 50)).toEqual({ state: 'unavailable' });

  const floodMonth = constraintsAtMonth(run, 2);
  expect(floodMonth.counts.transport).toBe(2);
  expect(floodMonth.counts.construction).toBe(0);
  const finding = floodMonth.findings.find(finding => finding.category === 'transport');
  expect(finding.progress).toBeNull();
  const replay = new URL(finding.replayLink, origin);
  expect(replay.searchParams.get('month')).toBe('2');
  expect(replay.searchParams.get('event')).toBe(finding.id);

  const evidence = new URL(finding.evidenceLink, origin);
  const explanation = await read('/api/causality/explain?' + evidence.searchParams);
  expect((await explanation.json()).nodes.some(event =>
    event.id === finding.id && event.type === 'UNREACHABLE_JOB')).toBe(true);
  expect(store.getRun(demoRunId).revision).toBe(revision);

  const missingFeed = path => path.startsWith('/api/causality/events?')
    ? new Response(null, { status: 503 }) : read(path);
  await expect(loadConstraintRun(demoRunId, missingFeed)).rejects.toThrow('retained event feed');
}, 20000);
