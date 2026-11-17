import { expect, test } from 'bun:test';
import { createExperimentsHandler } from '../world/experiments-api.js';
import { showRunLifecycle } from '../world/run-lifecycle-ui.js';

const request = (path = '', method = 'GET', body) => new Request(`http://local/api/world/experiments${path}`, {
  method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
});
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
async function until(fn) {
  for (let i = 0; i < 100; i++) { const result = await fn(); if (result) return result; await new Promise(r => setTimeout(r, 1)); }
  throw Error('State not observed');
}

test('observed backend lifecycle, cancellation races and seed-matched retry', async () => {
  const town = deferred(), running = deferred();
  let calls = 0;
  const inputs = [];
  const handle = createExperimentsHandler({
    getArea: () => town.promise,
    runner: async ({ baseSeed, seeds, onProgress, shouldStop }) => {
      calls++; inputs.push({ baseSeed, seeds });
      if (calls === 1) { await running.promise; expect(shouldStop()).toBe(true); onProgress({ step: 99, totalSteps: 99 }); }
      if (calls === 2) throw Error('Controlled failure');
      return { meta: {} };
    },
  });
  const read = async id => (await handle(request(`/${id}`))).json();
  const action = async (id, name) => (await handle(request(`/${id}/${name}`, 'POST'))).json();
  const first = await (await handle(request('', 'POST', { proposalIds: ['t_bus'], baseSeed: 'she80-seed', seeds: 1, maxPeople: 30 }))).json();
  const id = first.experimentId;
  await until(async () => (await read(id)).lifecycle === 'starting');
  town.resolve(null);
  await until(async () => (await read(id)).lifecycle === 'running');
  const second = await (await handle(request('', 'POST', { proposalIds: ['t_bus'] }))).json();
  expect(second.lifecycle).toBe('queued');
  await action(second.experimentId, 'cancel');
  expect((await read(second.experimentId)).lifecycle).toBe('canceled');
  expect((await action(id, 'cancel')).lifecycle).toBe('canceled');
  running.resolve();
  await action(id, 'retry');
  const failed = await until(async () => { const j = await read(id); return j.lifecycle === 'failed' && j; });
  expect(failed.error).toBe('Controlled failure');
  expect(failed.result).toBeUndefined();
  await action(id, 'retry');
  const completed = await until(async () => { const j = await read(id); return j.lifecycle === 'completed' && j; });
  expect(completed.events.map(e => e.state)).toEqual(['queued', 'starting', 'running', 'canceled', 'retrying', 'starting', 'running', 'failed', 'retrying', 'starting', 'running', 'completed']);
  expect(completed.attempt).toBe(3);
  expect(inputs).toEqual(Array(3).fill({ baseSeed: 'she80-seed', seeds: 1 }));
  expect(completed.progress.step).toBe(0); // canceled progress never leaked
  expect((await handle(request(`/${id}/retry`, 'POST'))).status).toBe(409);
  expect((await action(id, 'cancel')).lifecycle).toBe('completed');
  expect(calls).toBe(3); // canceled queued run never executed
  if (process.env.HBL_LIFECYCLE_RECEIPT) await Bun.write(process.env.HBL_LIFECYCLE_RECEIPT, JSON.stringify({
    schemaVersion: 'hbl-lifecycle-verification.v1',
    source: 'Observed createExperimentsHandler events with injected synthetic runner and area gate',
    model: 'controlled lifecycle fixture v1; no modeled city outcome claimed',
    command: 'HBL_LIFECYCLE_RECEIPT=docs/evidence/she80-lifecycle.json bun test test/run-lifecycle.test.js',
    inputs: { proposalIds: ['t_bus'], baseSeed: 'she80-seed', seeds: 1, maxPeople: 30 },
    events: completed.events, queuedCancellation: (await read(second.experimentId)).events,
    attempts: inputs, result: 'passed',
  }, null, 2) + '\n');
});

for (const state of ['queued', 'starting', 'running', 'completed', 'failed', 'canceled', 'retrying']) {
  test(`UI status and controls for ${state}`, () => {
    const nodes = Object.fromEntries(['status', 'run', 'cancel', 'retry', 'progress'].map(key => [key, { dataset: {} }]));
    const terminal = ['completed', 'failed', 'canceled'].includes(state);
    expect(showRunLifecycle({ lifecycle: state, progress: { step: 2, totalSteps: 4 } }, nodes)).toBe(terminal);
    expect(nodes.status.textContent.startsWith(state[0].toUpperCase() + state.slice(1))).toBe(true);
    expect(nodes.run.disabled).toBe(!terminal);
    expect(nodes.cancel.hidden).toBe(terminal);
    expect(nodes.retry.hidden).toBe(!['failed', 'canceled'].includes(state));
    expect(nodes.progress.hidden).toBe(terminal);
  });
}

test('canceling during town preparation prevents the runner from starting', async () => {
  const gate = deferred(); let calls = 0;
  const handle = createExperimentsHandler({ getArea: () => gate.promise, runner: async () => { calls++; return { meta: {} }; } });
  const job = await (await handle(request('', 'POST', { proposalIds: ['t_bus'] }))).json();
  const path = `/${job.experimentId}`;
  await until(async () => (await (await handle(request(path))).json()).lifecycle === 'starting');
  await handle(request(`${path}/cancel`, 'POST'));
  gate.resolve(null);
  await new Promise(resolve => setTimeout(resolve, 5));
  const canceled = await (await handle(request(path))).json();
  expect(canceled.lifecycle).toBe('canceled');
  expect(canceled.result).toBeUndefined();
  expect(calls).toBe(0);
});

test('retry respects the paired queue budget and canceled attempts release it once settled', async () => {
  const gate = deferred();
  let calls = 0;
  const handle = createExperimentsHandler({ runner: async () => {
    if (++calls === 1) throw Error('Controlled first failure');
    await gate.promise;
    return { meta: {} };
  } });
  const submit = () => handle(request('', 'POST', { proposalIds: ['t_bus'], procedural: true, maxPeople: 1 }));
  const read = async id => (await handle(request(`/${id}`))).json();
  const failed = await (await submit()).json();
  await until(async () => (await read(failed.experimentId)).lifecycle === 'failed');
  const accepted = [];
  for (let i = 0; i < 9; i++) {
    const response = await submit();
    expect(response.status).toBe(202);
    accepted.push(await response.json());
  }
  await handle(request(`/${accepted[1].experimentId}/cancel`, 'POST'));
  const retry = await handle(request(`/${failed.experimentId}/retry`, 'POST'));
  expect(retry.status).toBe(429);
  expect(retry.headers.get('retry-after')).toBe('1');
  expect((await retry.json()).budget).toEqual({ pending: 9, maxPending: 9 });
  expect((await read(failed.experimentId)).attempt).toBe(1);
  expect((await submit()).status).toBe(429);
  gate.resolve();
  await until(async () => (await read(accepted[8].experimentId)).lifecycle === 'completed');
  expect((await read(accepted[1].experimentId)).lifecycle).toBe('canceled');
  expect(calls).toBe(9); // failed first attempt plus eight non-canceled runs
  expect((await handle(request(`/${failed.experimentId}/retry`, 'POST'))).status).toBe(202);
  await until(async () => (await read(failed.experimentId)).lifecycle === 'completed');
  expect((await read(failed.experimentId)).attempt).toBe(2);
  expect(calls).toBe(10);
});
