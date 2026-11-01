import { describe, expect, test } from "bun:test";
import { createExperimentsHandler, findPackage } from "./experiments-api.js";

const post = (body) => new Request("http://x/api/world/experiments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const get = (path) => new Request(`http://x${path}`);

async function waitDone(handle, id) {
  for (let i = 0; i < 1000; i++) {
    const res = await handle(get(`/api/world/experiments/${id}`));
    const job = await res.json();
    if (job.status === "done" || job.status === "error") return job;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timed out");
}

const fakeRunner = async ({ plan, seeds, onProgress }) => {
  onProgress({ step: 1, totalSteps: 1 });
  return { meta: { plan, seeds }, final: {}, series: [], futures: { positive: seeds, neutral: 0, negative: 0 }, runs: [] };
};

describe("findPackage", () => {
  const payload = { packages: [{ id: "A", name: "Balanced" }, { id: "B", name: "Minimal change" }] };
  test("matches by name, id, or substring", () => {
    expect(findPackage(payload, "balanced").id).toBe("A");
    expect(findPackage(payload, "b").id).toBe("B");
    expect(findPackage(payload, "minimal").id).toBe("B");
    expect(findPackage(payload, "storm")).toBeNull();
  });
});

describe("/api/world/experiments", () => {
  test("runs a proposal-id plan and clamps params", async () => {
    const handle = createExperimentsHandler({ runner: fakeRunner });
    const res = await handle(post({ proposalIds: ["t_bus", "hc_chc"], seeds: 999, years: 0 }));
    expect(res.status).toBe(202);
    const started = await res.json();
    expect(started.params.seeds).toBe(32);
    expect(started.params.years).toBe(5);
    expect(started.plan.unsupported).toEqual(["hc_chc"]);
    const job = await waitDone(handle, started.experimentId);
    expect(job.status).toBe("done");
    expect(job.result.futures.positive).toBe(32);
    expect(job.result.meta.location.name).toBe("Gulfton, Houston");
  });

  test("resolves a Dear Congress package by name", async () => {
    const fetchPlan = async () => ({ packages: [{ id: "A", name: "Balanced", items: [{ proposal: { id: "f_drainage", costB: 2 } }] }] });
    const handle = createExperimentsHandler({ fetchPlan, runner: fakeRunner });
    const started = await (await handle(post({ package: "Balanced", seeds: 2 }))).json();
    const job = await waitDone(handle, started.experimentId);
    expect(job.result.meta.plan.label).toBe("Balanced");
    expect(job.result.meta.plan.actions[0].proposalId).toBe("f_drainage");
  });

  test("rejects requests without a plan and unknown ids", async () => {
    const handle = createExperimentsHandler({ runner: fakeRunner });
    expect((await handle(post({}))).status).toBe(400);
    expect((await handle(get("/api/world/experiments/nope"))).status).toBe(404);
  });

  test("real runner end to end on a tiny town", async () => {
    const handle = createExperimentsHandler({});
    const started = await (await handle(post({ proposalIds: ["t_bus"], seeds: 1, checkpoints: [3], maxPeople: 30 }))).json();
    const job = await waitDone(handle, started.experimentId);
    expect(job.status).toBe("done");
    expect(job.result.final.avgWalkMinutes.delta.mean).toBeLessThan(0);
  }, 30000);
});
