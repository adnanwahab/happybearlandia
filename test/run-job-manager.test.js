import { describe, expect, test } from "bun:test";
import { RunJobManager } from "../world/run-job-manager.js";
import { createSimulationAdapter } from "../world/simulation-adapter.js";

const experiment = { id: "e1", plan: { id: "p1" }, model: { version: 1 } };
const worldBatch = { seed: 42, worlds: Array.from({ length: 25 }, (_, i) => ({ id: `w${i}`, normalized: { x: i / 24 } })) };
const adapter = createSimulationAdapter({ id: "scale-test", simulateWorld: ({ world }) => ({ score: world.normalized.x * 100 }) });

describe("scalable experiment runner", () => {
  test("reports progress and produces deterministic ordered results", async () => {
    const manager = new RunJobManager();
    const job = manager.createJob({ experiment, worldBatch, adapter, chunkSize: 7 });
    const progress = [];
    manager.onProgress(job.id, (row) => progress.push(row.completed));
    const done = await manager.wait(job.id);
    expect(done.status).toBe("complete");
    expect(done.simulationBatch.simulations).toHaveLength(25);
    expect(done.simulationBatch.simulations[24].worldId).toBe("w24");
    expect(progress.at(-1)).toBe(25);
  });
  test("reuses cached per-world simulations", async () => {
    let calls = 0;
    const counted = createSimulationAdapter({ id: "cache-test", simulateWorld: ({ world }) => { calls += 1; return { score: world.normalized.x * 100 }; } });
    const cache = new Map();
    const first = new RunJobManager({ cache });
    const a = first.createJob({ experiment, worldBatch, adapter: counted });
    await first.wait(a.id);
    expect(calls).toBe(25);
    const second = new RunJobManager({ cache });
    const b = second.createJob({ experiment, worldBatch, adapter: counted });
    await second.wait(b.id);
    expect(calls).toBe(25);
  });
});

test('burst admission bounds jobs and adapter fanout without duplicate writes', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let active = 0, peak = 0, calls = 0;
  const held = createSimulationAdapter({ id: 'held', simulateWorld: async () => {
    active++; calls++; peak = Math.max(peak, active);
    await gate; active--; return { score: 1 };
  } });
  const manager = new RunJobManager();
  const jobs = Array.from({ length: 10 }, (_, i) => manager.createJob({ experiment: { ...experiment, id: `burst${i}`, plan: { id: `p${i}` } }, worldBatch, adapter: held, concurrency: 64 }));
  expect(manager.budget().active).toBe(2);
  expect(manager.budget().queued).toBe(8);
  expect(manager.createJob({ experiment: { ...experiment, id: 'burst0', plan: { id: 'p0' } }, worldBatch, adapter: held }).id).toBe(jobs[0].id);
  expect(() => manager.createJob({ experiment: { ...experiment, id: 'overflow' }, worldBatch, adapter: held })).toThrow('capacity');
  expect(manager.get(jobs[9].id).status).toBe('queued');
  release();
  const completed = await Promise.all(jobs.map(job => manager.wait(job.id)));
  expect(completed.every(job => job.status === 'complete')).toBe(true);
  expect(peak).toBeLessThanOrEqual(16);
  expect(calls).toBe(250);
  expect(manager.cache.size).toBe(250);
  expect(new Set(completed[9].simulationBatch.simulations.map(row => row.worldId)).size).toBe(25);
});

test('HTTP overload includes retry guidance and failure releases admission', async () => {
  const { createRunApiHandler } = await import('../world/run-job-manager.js');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const held = createSimulationAdapter({ id: 'failure', simulateWorld: async () => { await gate; throw new Error('adapter failed'); } });
  const manager = new RunJobManager();
  let sequence = 0;
  const handle = createRunApiHandler(manager, async () => ({ experiment: { ...experiment, id: `http${sequence++}` }, worldBatch, adapter: held }));
  const request = () => new Request('http://test/api/runs', { method: 'POST', body: '{}' });
  const accepted = await Promise.all(Array.from({ length: 10 }, () => handle(request()).then(r => r.json())));
  const overload = await handle(request());
  expect(overload.status).toBe(429);
  expect(overload.headers.get('retry-after')).toBe('1');
  expect((await overload.json()).budget.queued).toBe(8);
  expect((await handle(new Request(`http://test/api/runs/${accepted[9].id}`))).status).toBe(200);
  release();
  await Promise.allSettled(accepted.map(job => manager.wait(job.id)));
  expect(accepted.every(job => manager.get(job.id).status === 'failed')).toBe(true);
  expect((await handle(request())).status).toBe(202);
});

test('failed job retains its slot until sibling adapter calls settle', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const adapter = createSimulationAdapter({ id: 'siblings', simulateWorld: async ({ world }) => {
    if (world.id === 'w0') throw new Error('first call failed');
    await gate; return { score: 1 };
  } });
  const manager = new RunJobManager();
  const job = manager.createJob({ experiment, worldBatch, adapter });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(manager.budget().active).toBe(1);
  expect(manager.get(job.id).status).toBe('running');
  release();
  await expect(manager.wait(job.id)).rejects.toThrow('first call failed');
  expect(manager.get(job.id).status).toBe('failed');
});
