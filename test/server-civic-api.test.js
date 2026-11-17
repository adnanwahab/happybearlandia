import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerCivicApiHandler } from "../world/server-civic-api.js";

const roots = [];
async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), "hbl-civic-api-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  while (roots.length) await rm(roots.pop(), { recursive: true, force: true });
});

function tinyExperiment() {
  return {
    schemaVersion: "civic-experiment.v1",
    id: "experiment_api_test",
    plan: { id: "plan_api_test", title: "API test plan", goals: [], actions: [] },
    worldModel: { variables: [], causalEdges: [], scenarioFamilies: [] },
    experiment: { runs: 2, horizonYears: 2, seed: 42 },
    outcomes: { metricRegistry: [] },
    lineage: { revision: 1 },
  };
}

function tinyWorldBatch() {
  return {
    schemaVersion: "world-batch.v2",
    experimentId: "experiment_api_test",
    seed: 42,
    runs: 2,
    worlds: [
      { id: "world_00001", index: 0, seed: 1, conditions: {}, normalized: {}, deviations: {} },
      { id: "world_00002", index: 1, seed: 2, conditions: {}, normalized: {}, deviations: {} },
    ],
  };
}

describe("server civic API wiring", () => {
  test("returns structured JSON for an unknown run instead of the generic server 404", async () => {
    const handler = createServerCivicApiHandler({ experimentRoot: await tempRoot() });
    const response = await handler(new Request("http://localhost/api/runs/not-a-real-run"));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Run not found" });
  });

  test("persists and reloads an experiment through /api/experiments", async () => {
    const handler = createServerCivicApiHandler({ experimentRoot: await tempRoot() });
    const create = await handler(new Request("http://localhost/api/experiments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshot: { experiment: tinyExperiment() } }),
    }));
    expect(create.status).toBe(201);
    const record = await create.json();
    expect(record.schemaVersion).toBe("hbl-server-experiment.v1");

    const load = await handler(new Request(`http://localhost/api/experiments/${record.id}`));
    expect(load.status).toBe(200);
    expect((await load.json()).snapshotHash).toBe(record.snapshotHash);
  });

  test("creates a scalable run job from an inline experiment/world batch", async () => {
    const handler = createServerCivicApiHandler({ experimentRoot: await tempRoot() });
    const create = await handler(new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        experiment: tinyExperiment(),
        worldBatch: tinyWorldBatch(),
        adapter: "stress",
        chunkSize: 1,
      }),
    }));
    expect(create.status).toBe(202);
    const job = await create.json();
    expect(job.schemaVersion).toBe("hbl-run-job.v1");
    expect(job.total).toBe(2);

    let final = null;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const response = await handler(new Request(`http://localhost/api/runs/${job.id}?results=1`));
      final = await response.json();
      if (final.status === "complete") break;
    }
    expect(final.status).toBe("complete");
    expect(final.simulationBatch.simulations).toHaveLength(2);
  });
});

test("normal server API exposes anonymous counters and Retry-After on saturation", async () => {
  let release;
  const handler = createServerCivicApiHandler({
    maxRunning: 1, maxQueued: 1,
    resolveAdapter: () => ({ id: "held-api", simulateWorld: () => new Promise(resolve => { release = resolve; }) }),
  });
  const submit = (id) => handler(new Request("http://localhost/api/runs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ experiment: { ...tinyExperiment(), id }, worldBatch: { ...tinyWorldBatch(), worlds: [tinyWorldBatch().worlds[0]] } }),
  }));
  expect((await submit("secret-first")).status).toBe(202);
  const queued = await submit("secret-second");
  expect(queued.status).toBe(202);
  expect((await queued.json()).status).toBe("queued");
  const rejected = await submit("secret-third");
  expect(rejected.status).toBe(429);
  expect(rejected.headers.get("retry-after")).toBe("1");
  expect(rejected.headers.get("cache-control")).toBe("no-store");
  const response = await handler(new Request("http://localhost/api/runs/metrics"));
  expect(response.headers.get("cache-control")).toBe("no-store");
  const metrics = await response.json();
  expect(metrics).toEqual({ schemaVersion: "hbl-run-queue-metrics.v1", submitted: 3, queued: 1, completed: 0, failed: 0, rejected: 1, deduplicated: 0, running: 1, queueDepth: 1, maxRunning: 1, maxQueued: 1 });
  release({ score: 1 });
  // The identical world/plan for the queued request uses the existing cache.
  for (let i = 0; i < 20; i++) {
    const final = await (await handler(new Request("http://localhost/api/runs/metrics"))).json();
    if (final.completed === 2) {
      expect(final.running).toBe(0);
      expect(final.queueDepth).toBe(0);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  throw Error("Queue did not drain");
});
