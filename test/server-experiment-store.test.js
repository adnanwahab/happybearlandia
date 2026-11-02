import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forkServerExperiment, listExperimentChildren, loadServerExperiment, saveServerExperiment } from "../world/server-experiment-store.js";
import { handleExperimentApi } from "../world/experiment-api.js";

const snapshot = (id, seed = 42) => ({ experiment: { id, plan: { title: `Plan ${id}` }, experiment: { seed } }, worldBatch: { seed, runs: 10 } });

describe("server experiment persistence", () => {
  test("saves immutable snapshots and records lineage", async () => {
    const root = await mkdtemp(join(tmpdir(), "hbl-exp-"));
    try {
      const parent = await saveServerExperiment(snapshot("exp_a"), { root });
      expect((await loadServerExperiment(parent.id, { root })).snapshotHash).toBe(parent.snapshotHash);
      const child = await forkServerExperiment(parent.id, snapshot("exp_b", 43), { root });
      expect(child.parentExperimentId).toBe(parent.id);
      expect(await listExperimentChildren(parent.id, { root })).toHaveLength(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  test("serves the persistence API contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "hbl-api-"));
    try {
      const response = await handleExperimentApi(new Request("http://localhost/api/experiments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(snapshot("exp_api")) }), { root });
      expect(response.status).toBe(201);
      const record = await response.json();
      const loaded = await handleExperimentApi(new Request(`http://localhost/api/experiments/${record.id}`), { root });
      expect((await loaded.json()).snapshot.experiment.id).toBe("exp_api");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
