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
