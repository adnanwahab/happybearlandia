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

test("bounded FIFO queue reconciles success, failure, duplicate and rejected traffic", async () => {
  const manager = new RunJobManager({ maxRunning: 1, maxQueued: 1 });
  const gates = [];
  const started = [];
  const held = createSimulationAdapter({ id: "held", simulateWorld: ({ experiment }) => {
    started.push(experiment.id);
    return new Promise((resolve, reject) => gates.push({ resolve, reject }));
  } });
  const input = (id) => ({ experiment: { ...experiment, id, plan: { id } }, worldBatch: { seed: 42, worlds: [worldBatch.worlds[0]] }, adapter: held });
  const a = manager.createJob(input("private-a"));
  const b = manager.createJob(input("private-b"));
  expect(b.status).toBe("queued");
  expect(manager.createJob(input("private-b")).id).toBe(b.id);
  expect(() => manager.createJob(input("private-c"))).toThrow("queue is full");
  expect(manager.metrics()).toEqual({ schemaVersion: "hbl-run-queue-metrics.v1", submitted: 4, queued: 1, completed: 0, failed: 0, rejected: 1, deduplicated: 1, running: 1, queueDepth: 1, maxRunning: 1, maxQueued: 1 });
  manager.onProgress(a.id, () => { throw Error("observer failure"); });
  gates[0].resolve({ score: 1 });
  await manager.wait(a.id);
  expect(started).toEqual(["private-a", "private-b"]);
  gates[1].reject(Error("private failure"));
  await expect(manager.wait(b.id)).rejects.toThrow("private failure");
  expect(manager.get(b.id).status).toBe("failed");
  const c = manager.createJob(input("private-c"));
  gates[2].resolve({ score: 2 });
  await manager.wait(c.id);
  const metrics = manager.metrics();
  expect(metrics).toMatchObject({ submitted: 5, queued: 1, completed: 2, failed: 1, rejected: 1, deduplicated: 1, running: 0, queueDepth: 0 });
  expect(metrics.submitted).toBe(metrics.completed + metrics.failed + metrics.rejected + metrics.deduplicated + metrics.running + metrics.queueDepth);
  expect(JSON.stringify(metrics)).not.toContain("private");
  metrics.completed = 900;
  expect(manager.metrics().completed).toBe(2);
});

test("queue limits validate and zero waiting capacity rejects while busy", async () => {
  for (const options of [{ maxRunning: 0 }, { maxQueued: -1 }, { maxRunning: Infinity }, { maxQueued: 1.5 }]) {
    expect(() => new RunJobManager(options)).toThrow("Invalid");
  }
  const manager = new RunJobManager({ maxRunning: 1, maxQueued: 0 });
  const a = manager.createJob({ experiment, worldBatch, adapter });
  expect(() => manager.createJob({ experiment: { ...experiment, id: "other" }, worldBatch, adapter })).toThrow("queue is full");
  await manager.wait(a.id);
  expect(manager.metrics()).toMatchObject({ completed: 1, rejected: 1, queued: 0 });
});
