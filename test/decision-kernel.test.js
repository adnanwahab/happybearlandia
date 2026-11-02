import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeDecisionInput, createDecisionManifest } from "../world/decision/contracts.js";
import { sampleDecisionParameters, executeDecisionExperiment, aggregateDecisionResults, percentile } from "../world/decision/kernel.js";
import { createDecisionStore, createMemoryDecisionStore } from "../world/decision/store.js";
import { createDecisionExperimentsHandler } from "../world/decision/api.js";

const model = { id: "housing.v1", version: "test-1", parameters: [{ id: "capacity", default: 5, min: 0, max: 10 }], metrics: [{ id: "cost", direction: "lower-is-better" }, { id: "homes", direction: "higher-is-better" }] };
const input = (extra = {}) => ({ schemaVersion: "decision-experiment.v1", name: "Kernel test", modelId: model.id, seed: 42, years: 2, runs: 10, scenarios: [
  { id: "baseline", name: "Current", kind: "baseline", parameters: { capacity: 2 }, uncertainty: { capacity: { type: "uniform", min: 1, max: 3 } } },
  { id: "plan", name: "Plan", kind: "plan-a", parameters: { capacity: 7 }, uncertainty: { capacity: { type: "triangular", min: 6, max: 9, mode: 7 } } },
], ...extra });
const simulateRun = ({ parameters, years }) => ({ metrics: { cost: 20 - parameters.capacity, homes: parameters.capacity * years }, timeline: Array.from({ length: years }, (_, i) => ({ year: i + 1, metrics: { cost: 20 - parameters.capacity, homes: parameters.capacity * (i + 1) } })), events: [], drivers: [] });
const cleanups = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()(); });

async function apiFixture(extra = {}) {
  const handler = createDecisionExperimentsHandler({ model, simulateRun, store: createMemoryDecisionStore(), useWorker: false, ...extra });
  cleanups.push(() => handler.close());
  return { handler, async request(path = "", method = "GET", body) {
    return handler(new Request(`http://local/api/decision-experiments${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }) }));
  } };
}
async function completed(request, id) {
  for (let i = 0; i < 200; i++) {
    const { experiment } = await (await request(`/${id}`)).json();
    if (["completed", "failed", "cancelled"].includes(experiment.status)) return experiment;
    await Bun.sleep(2);
  }
  throw new Error("Timeout");
}

describe("decision contracts and sampling", () => {
  test("validates bounds, scenario identity, distributions, and manifest versions", () => {
    const normalized = normalizeDecisionInput(input(), model);
    expect(normalized.scenarios[0].parameters.capacity).toBe(2);
    expect(() => normalizeDecisionInput(input({ runs: 1001 }), model)).toThrow("runs");
    expect(() => normalizeDecisionInput(input({ years: 0 }), model)).toThrow("years");
    expect(() => normalizeDecisionInput(input({ scenarios: [{ id: "../bad", name: "Bad", kind: "baseline", parameters: { capacity: Infinity } }] }), model)).toThrow();
    const manifest = createDecisionManifest(normalized, model);
    expect(normalizeDecisionInput({ manifest }, model)).toEqual(normalized);
    manifest.experiment.modelVersion = "old";
    expect(() => normalizeDecisionInput(manifest, model)).toThrow("unavailable");
  });
  test("reproduces independent bounded distribution draws with variable seeds", () => {
    const uncertainty = { a: { type: "uniform", min: 1, max: 4 }, b: { type: "triangular", min: 0, max: 1, mode: .2 }, c: { type: "normal", min: -1, max: 1, mean: 0, stddev: 2 }, d: { type: "fixed", value: 9 } };
    const a = sampleDecisionParameters({}, uncertainty, 42);
    expect(a).toEqual(sampleDecisionParameters({}, uncertainty, 42));
    expect(a).not.toEqual(sampleDecisionParameters({}, uncertainty, 43));
    expect(a.a).toBeGreaterThanOrEqual(1); expect(a.a).toBeLessThanOrEqual(4);
    expect(a.b).toBeGreaterThanOrEqual(0); expect(a.b).toBeLessThanOrEqual(1);
    expect(Math.abs(a.c)).toBeLessThanOrEqual(1); expect(a.d).toBe(9);
    expect(sampleDecisionParameters({}, { a: uncertainty.a }, 42).a).toBe(a.a);
  });
});

describe("decision kernel", () => {
  test("matches seeds, reproduces outcomes, and isolates run failures", async () => {
    const experiment = { ...normalizeDecisionInput(input(), model), id: "exp" };
    const execute = () => executeDecisionExperiment({ experiment, model, simulateRun: (args) => { if (args.parameters.capacity < 2) throw new Error("deliberate failure"); return simulateRun(args); } });
    const a = await execute(), b = await execute();
    expect(a.progress.failed).toBeGreaterThan(0);
    expect(a.progress.successful + a.progress.failed).toBe(20);
    expect(a.runs.map(({ seed, metrics, status }) => ({ seed, metrics, status }))).toEqual(b.runs.map(({ seed, metrics, status }) => ({ seed, metrics, status })));
    for (let i = 0; i < 20; i += 2) expect(a.runs[i].seed).toBe(a.runs[i + 1].seed);
    expect(a.comparisons[0].metrics.homes.probabilityImprovement).toBe(1);
    expect(a.comparisons[0].metrics.cost.probabilityImprovement).toBe(1);
    expect(a.aggregates[0].count + a.aggregates[0].failed).toBe(10);
  });
  test("cancels scheduling while preserving actual partial progress", async () => {
    let cancel = false;
    const result = await executeDecisionExperiment({ experiment: { ...normalizeDecisionInput(input({ runs: 100 }), model), id: "cancel" }, model, simulateRun, shouldCancel: () => cancel, yieldEvery: 4, onProgress: (update) => { if (update.progress.completed >= 4) cancel = true; } });
    expect(result.status).toBe("cancelled"); expect(result.runs).toHaveLength(4); expect(result.progress.total).toBe(200);
  });
  test("calculates interpolated percentiles and direction-aware matched comparisons", () => {
    expect(percentile([0, 10, 20, 30], .1)).toBeCloseTo(3); expect(percentile([], .5)).toBeNull();
    const rows = [
      { scenarioId: "baseline", seed: 1, status: "completed", metrics: { cost: 10, homes: 10 } },
      { scenarioId: "baseline", seed: 2, status: "completed", metrics: { cost: 20, homes: 20 } },
      { scenarioId: "plan", seed: 1, status: "completed", metrics: { cost: 5, homes: 15 } },
      { scenarioId: "plan", seed: 2, status: "completed", metrics: { cost: 25, homes: 25 } },
      { scenarioId: "plan", seed: 3, status: "completed", metrics: { cost: 100, homes: 100 } },
    ];
    const result = aggregateDecisionResults({ experiment: input(), runs: rows, model });
    expect(result.comparisons[0].metrics.cost).toEqual({ meanDelta: 0, medianDelta: 0, probabilityImprovement: .5, pairedCount: 2 });
    expect(result.comparisons[0].metrics.homes.probabilityImprovement).toBe(1);
    expect(result.aggregates[1].count).toBe(3);
  });
});

describe("decision persistence and API", () => {
  test("atomic disk snapshots reload privately and reject public directories", async () => {
    const directory = await mkdtemp(join(tmpdir(), "decision-store-test-"));
    cleanups.push(() => rm(directory, { recursive: true, force: true }));
    const store = createDecisionStore({ directory });
    const record = { experiment: { id: "safe", status: "completed" }, runs: [{ seed: 42 }] };
    await store.save(record);
    expect(await createDecisionStore({ directory }).load("safe")).toEqual(record);
    expect((await stat(join(directory, "safe.json"))).mode & 0o777).toBe(0o600);
    expect(() => createDecisionStore({ directory: "world/private" })).toThrow("publicly served");
    await expect(store.load("../escape")).rejects.toThrow("Invalid");
  });
  test("create/start/results/run/share/manifest replay and SSE serialize actual outcomes", async () => {
    const { request } = await apiFixture();
    const created = await request("", "POST", input()); expect(created.status).toBe(201);
    const { experiment } = await created.json();
    expect((await request(`/${experiment.id}/start`, "POST")).status).toBe(202);
    expect((await completed(request, experiment.id)).status).toBe("completed");
    const result = await (await request(`/${experiment.id}/results`)).json();
    expect(result.runs).toHaveLength(20); expect(result.aggregates).toHaveLength(2);
    expect((await (await request(`/${experiment.id}/runs/${result.runs[0].id}`)).json()).run).toEqual(result.runs[0]);
    const manifest = await (await request(`/${experiment.id}/manifest`)).json();
    const imported = await (await request("", "POST", { manifest })).json();
    await request(`/${imported.experiment.id}/start`, "POST"); await completed(request, imported.experiment.id);
    const replay = await (await request(`/${imported.experiment.id}/results`)).json();
    expect(replay.runs.map((row) => row.metrics)).toEqual(result.runs.map((row) => row.metrics));
    expect((await (await request(`/${experiment.id}/share`)).json()).readOnly).toBe(true);
    const sse = await request(`/${experiment.id}/events`); expect(await sse.text()).toContain("event: complete");
    expect((await request(`/${experiment.id}/share/start`, "POST")).status).toBe(405);
    expect((await request("", "POST", input({ years: 999 }))).status).toBe(400);
  });
  test("API cancellation interrupts a large running experiment", async () => {
    const { request } = await apiFixture();
    const { experiment } = await (await request("", "POST", input({ runs: 1000 }))).json();
    await request(`/${experiment.id}/start`, "POST");
    await request(`/${experiment.id}/cancel`, "POST");
    const end = await completed(request, experiment.id);
    expect(end.status).toBe("cancelled"); expect(end.progress.completed).toBeLessThan(end.progress.total);
  });
  test("preview retention prunes only old terminal previews and keeps saved experiments", async () => {
    const { request } = await apiFixture();
    const saved = (await (await request("", "POST", input())).json()).experiment;
    let firstPreview;
    for (let index = 0; index < 23; index++) {
      const response = await request("", "POST", input({ metadata: { preview: true } }));
      expect(response.status).toBe(201);
      const { experiment } = await response.json();
      firstPreview ||= experiment.id;
      await request(`/${experiment.id}/cancel`, "POST");
      if (index === 0) await Bun.sleep(2); // Distinguish oldest timestamp from same-millisecond peers.
    }
    const { experiments } = await (await request()).json();
    expect(experiments).toHaveLength(21);
    expect(experiments.some((row) => row.id === saved.id)).toBe(true);
    expect((await request(`/${firstPreview}`)).status).toBe(404);
    expect(experiments[0].shareUrl).toContain("&readonly=1");
  });
  test("rejects oversized request bodies before storing an experiment", async () => {
    const { handler, request } = await apiFixture();
    const response = await handler(new Request("http://local/api/decision-experiments", { method: "POST", body: " ".repeat(524289) }));
    expect(response.status).toBe(413);
    expect((await (await request()).json()).experiments).toHaveLength(0);
  });
});

describe("housing stress integration", () => {
  test("composes shocks after draws once, records provenance and reproduces effective inputs", async () => {
    const { housingModel, createHousingScenarios, simulateHousingRun, stressPresets } = await import("../world/models/housing/index.js");
    const fixture = await apiFixture({ model: housingModel, simulateRun: simulateHousingRun, stressPresets });
    const scenarios = createHousingScenarios().slice(0, 2);
    scenarios[1].stressPresets = ["supply-constraint", "high-inflation", "budget-cut"];
    const payload = { ...input(), modelVersion: housingModel.version, scenarios, runs: 3 };
    const { experiment } = await (await fixture.request("", "POST", payload)).json();
    await fixture.request(`/${experiment.id}/start`, "POST");
    expect((await completed(fixture.request, experiment.id)).status).toBe("completed");
    const results = await (await fixture.request(`/${experiment.id}/results`)).json();
    for (const run of results.runs.filter((row) => row.scenarioId === scenarios[1].id)) {
      expect(run.sampledParameters.construction_capacity).toBe(36000);
      expect(run.sampledParameters.interest_rate).toBeGreaterThanOrEqual(.085);
      expect(run.sampledParameters.funding_delivery).toBe(.5);
      expect(run.preStressSampledParameters.construction_capacity).toBeGreaterThanOrEqual(50000);
      expect(run.appliedStressPresets).toEqual(scenarios[1].stressPresets);
      expect(simulateHousingRun({ parameters: run.sampledParameters, seed: run.seed, years: payload.years }).metrics).toEqual(run.metrics);
    }
    const manifest = await (await fixture.request(`/${experiment.id}/manifest`)).json();
    const { experiment: replay } = await (await fixture.request("", "POST", { manifest })).json();
    await fixture.request(`/${replay.id}/start`, "POST"); await completed(fixture.request, replay.id);
    const rerun = await (await fixture.request(`/${replay.id}/results`)).json();
    expect(rerun.runs.map((row) => row.sampledParameters)).toEqual(results.runs.map((row) => row.sampledParameters));
    const unknown = structuredClone(payload); unknown.scenarios[1].stressPresets = ["unknown-preset"];
    expect((await fixture.request("", "POST", unknown)).status).toBe(400);
  });
});
