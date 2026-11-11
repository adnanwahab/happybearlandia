import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { demoCheckpointId, demoRunId } from '../world/causal/demo.js';
import { CONTRACTS } from '../world/city/contracts.js';
import { createCity } from '../world/city/seed.js';
import { auditCityCheckpoint, loadAuditMonth, loadAuditRun } from '../world/civilization/debugger/model.js';

const origin = 'http://localhost';

test('broken cross-references and flow records are separate from modeled shortages', () => {
  const state = createCity({ households: 3 });
  state.month = 1;
  const household = state.households[0];
  const unit = state.units.find(row => row.id === household.unitId);
  unit.householdId = null;
  unit.status = 'available';
  household.unitId = null;
  state.workers[0].householdId = 'missing-household';
  state.jobs[0].businessId = 'missing-employer';
  state.flows = [
    { schemaVersion: CONTRACTS.ResourceFlow, time: 0, amount: -1 },
    { schemaVersion: 'unrecognized', time: 1, amount: 2 },
  ];

  const { checks, scarcity } = auditCityCheckpoint(state);
  expect(checks[0]).toEqual({ name: 'CityState contract', issues: [] });
  expect(checks[1].issues).toEqual(['worker-0 refers to a missing household (missing-household).']);
  expect(checks[2].issues).toEqual(['job-d0-0 refers to a missing business (missing-employer).']);
  expect(checks[3].issues).toEqual([
    'Flow 1 is outside the checkpoint month.',
    'Flow 1 has an invalid amount.',
    'Flow 2 has an unsupported record version.',
  ]);
  expect(scarcity[0]).toEqual({ name: 'Households without an assigned home', count: 1 });

  unit.status = 'occupied';
  expect(auditCityCheckpoint(state)).toEqual({
    checks: [{ name: 'CityState contract', issues: ['Occupied unit has no household'] }],
    scarcity: null,
  });
});

test('recorded checkpoints use the real API and distinguish unavailable or rejected state', async () => {
  using db = new Database(':memory:');
  const store = createCausalStore(db);
  const handler = createCausalityHandler({ store });
  const requests = [];
  const fetcher = async path => {
    const url = new URL(path, origin);
    if (url.pathname.endsWith('/checkpoints')) url.searchParams.set('limit', '5');
    requests.push(url);
    return handler(new Request(url));
  };
  expect(await loadAuditRun(demoRunId, fetcher)).toEqual({ state: 'missing' });
  const setup = await handler(new Request(origin + '/api/causality/world-scenario', { method: 'POST' }));
  expect(setup.status).toBe(200);
  const revision = store.getRun(demoRunId).revision;

  const run = await loadAuditRun(demoRunId, fetcher);
  expect(run.state).toBe('ready');
  expect(run.checkpoints.size).toBe(21);
  expect(requests.some(url => url.searchParams.has('afterSequence'))).toBe(true);
  const report = await loadAuditMonth(run, 2, fetcher);
  expect(report.state).toBe('ready');
  expect(report.checkpoint.id).toBe(demoCheckpointId(demoRunId, 2));
  expect(report.report.checks.map(row => row.issues)).toEqual([[], [], [], []]);
  expect(report.report.scarcity[0].count).toBe(5);
  expect(new URL(report.replayLink, origin).searchParams.get('month')).toBe('2');
  expect((await loadAuditMonth(run, 0, fetcher)).report.scarcity).toHaveLength(2);
  expect(await loadAuditMonth(run, 30, fetcher)).toEqual({ state: 'unavailable' });
  expect(await loadAuditMonth(run, 2, async () => Response.json({ error: 'BAD_CHECKPOINT' }, { status: 409 })))
    .toEqual({ state: 'rejected', reason: 'BAD_CHECKPOINT' });
  const wrongCheckpoint = async path => {
    const state = await (await fetcher(path)).json();
    state.checkpoint.id = demoCheckpointId(demoRunId, 1);
    return Response.json(state);
  };
  expect(await loadAuditMonth(run, 2, wrongCheckpoint))
    .toEqual({ state: 'rejected', reason: 'The returned state did not match the selected stored checkpoint.' });
  for (const month of run.checkpoints.keys()) {
    const result = await loadAuditMonth(run, month, fetcher);
    expect(result.report.checks.every(row => !row.issues.length)).toBe(true);
  }
  expect(store.getRun(demoRunId).revision).toBe(revision);
}, 20000);
