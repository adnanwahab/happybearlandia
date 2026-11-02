import { describe, test, expect } from "bun:test";
import { normalizeDecisionInput, classifyDecisionOutcome, createDecisionManifest } from "../world/decision/contracts.js";
import { executeDecisionExperiment } from "../world/decision/kernel.js";
import { createDecisionExperimentsHandler } from "../world/decision/api.js";
import { createMemoryDecisionStore } from "../world/decision/store.js";
import { createOptimizationApiHandler } from "../world/decision/optimization-api.js";
import { normalizeOptimizationInput, executeOptimizationJob, generateOptimizationCandidates, paretoCandidates, optimizationCandidateProposal } from "../world/decision/optimization.js";
import { applyApprovedWorldEdit, hashWorldEditProposal } from "../world/ai/revisions.js";
import { housingModel, createHousingScenarios, simulateHousingRun } from "../world/models/housing/index.js";
import { createBuildingProposal } from "../world/buildings/proposal.js";
import { analyzeBuildingProjects } from "../world/buildings/project-analysis.js";
const model = { id: "housing.v1", version: "test", parameters: [{ id: "capacity", default: 5, min: 0, max: 10 }], metrics: [{ id: "cost", direction: "lower" }, { id: "homes", direction: "higher" }] };
const simpleInput = () => ({ schemaVersion: "decision-experiment.v1", name: "Search", modelId: model.id, modelVersion: model.version, seed: 42, runs: 2, years: 2, scenarios: [{ id: "baseline", name: "Current", kind: "baseline", parameters: { capacity: 5 }, uncertainty: {} }], metadata: {} });
const simulateRun = ({ parameters, seed, years }) => ({ metrics: { cost: 20 - parameters.capacity + (seed % 5) / 10, homes: parameters.capacity }, timeline: [{ year: years, metrics: { cost: 20 - parameters.capacity + (seed % 5) / 10, homes: parameters.capacity } }], monthlyTimeline: [{ month: 0, year: 0, metrics: { cost: 10, homes: 0 } }], projects: [{ projectId: "x", states: [{ month: 0 }] }] });
const search = () => ({ input: simpleInput(), scenarioId: "baseline", levers: [{ parameterId: "capacity", min: 0, max: 10 }], objectives: [{ metricId: "cost", direction: "minimize" }], constraints: [], candidateCount: 2, finalists: 1 });
async function api(handler, path, body) { const response = await handler(new Request(`http://local${path}`, { method: body === undefined ? "GET" : "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) })); return { status: response.status, body: await response.json() }; }
async function terminal(handler, path, key) { for (let i = 0; i < 2000; i++) { const { body } = await api(handler, path); if (["completed", "failed", "cancelled"].includes(body[key]?.status)) return body[key]; await Bun.sleep(2); } throw new Error("Timeout"); }

describe("scenario inheritance and recorded outcomes", () => {
  test("explicit overrides inherit parent changes and approved edits reach effective model inputs", async () => {
    const raw = simpleInput(); raw.scenarios.push({ id: "child", name: "Child", kind: "alternative", inheritsFrom: "baseline", overrides: {} });
    const first = normalizeDecisionInput(raw, model); first.scenarios[0].parameters.capacity = 7;
    const next = normalizeDecisionInput(first, model); expect(next.scenarios[1].parameters.capacity).toBe(7);
    const proposal = { schemaVersion: "world-edit.v1", summary: "Change inherited capacity", operations: [{ op: "set_parameter", target: "capacity", value: 9 }], warnings: [], baseRevision: "root" };
    const edited = await applyApprovedWorldEdit({ input: next, proposal, scenarioId: "child", model, approval: true });
    expect(edited.input.scenarios[1].overrides.parameters.capacity).toBe(9);
    expect((await executeDecisionExperiment({ experiment: edited.input, model, simulateRun })).runs.find((run) => run.scenarioId === "child").sampledParameters.capacity).toBe(9);
    const cyclic = simpleInput(); cyclic.scenarios[0].inheritsFrom = "baseline"; expect(() => normalizeDecisionInput(cyclic, model)).toThrow("cycle");
  });
  test("mixed is defined only by explicit success/failure rules; failure precedence is recorded", () => {
    const scenario = { outcomeCriteria: { success: [{ metricId: "cost", operator: "lte", value: 10 }], failure: [{ metricId: "cost", operator: "gte", value: 20 }] } };
    expect(classifyDecisionOutcome({ cost: 5 }, scenario)).toBe("success"); expect(classifyDecisionOutcome({ cost: 15 }, scenario)).toBe("mixed"); expect(classifyDecisionOutcome({ cost: 25 }, scenario)).toBe("failure"); expect(classifyDecisionOutcome({}, scenario)).toBe("unclassified"); expect(classifyDecisionOutcome({ cost: 5 }, {})).toBe("unclassified");
  });
});
describe("bounded optimization", () => {
  test("approved candidate audit retains immutable job and search provenance", async () => {
    const original = simpleInput();
    const config = normalizeOptimizationInput({ ...search(), sourceExperimentId: "decision_source" }, model);
    const candidate = { ...generateOptimizationCandidates(config)[0], stage: "finalist", runs: 500 };
    const job = { id: "optimization_recorded", config };
    const proposal = optimizationCandidateProposal({ input: original, candidate, sourceScenarioId: "baseline", job });
    const applied = await applyApprovedWorldEdit({ input: original, proposal, scenarioId: "baseline", model, approval: true });
    const provenance = JSON.parse(applied.revision.prompt.slice("Optimization provenance: ".length));
    expect(provenance.optimizationJobId).toBe(job.id); expect(provenance.candidateId).toBe(candidate.id); expect(provenance.stage).toBe("finalist");
    expect(provenance.objectives).toEqual(config.objectives); expect(provenance.constraints).toEqual(config.constraints);
    expect(provenance.sourceExperimentId).toBe("decision_source"); expect(provenance.sourceInputFingerprint).toBe(config.sourceInputFingerprint);
    expect(applied.input.metadata.worldEditHistory[0].prompt).toBe(applied.revision.prompt);
  });
  test("deterministic candidate generation, exact100/500 stages, paired deltas and Pareto", async () => {
    const config = normalizeOptimizationInput(search(), model);
    expect(generateOptimizationCandidates(config)).toEqual(generateOptimizationCandidates(config));
    const run = () => executeOptimizationJob({ config, model, simulateRun });
    const first = await run(), second = await run();
    expect(first.candidates).toEqual(second.candidates);
    expect(first.progress.completed).toBe(1400);
    expect(first.candidates.map((candidate) => candidate.runs).sort()).toEqual([100, 500]);
    expect(first.candidates.find((candidate) => candidate.stage === "finalist").comparisons.metrics.cost.meanDelta).toBeCloseTo(-5);
    expect(first.pareto).toEqual(["candidate_2"]);
    expect(first.fullRunRetention).toBe(false);
    const result = await executeDecisionExperiment({ experiment: config.input, model, simulateRun, retainTraces: false });
    expect(result.runs[0].timeline).toEqual([]); expect(result.runs[0].monthlyTimeline).toBeUndefined(); expect(result.runs[0].projects).toBeUndefined(); expect(result.runs[0].metrics).toBeDefined();
  });
  test("isolates failures, cancels promptly and rejects unbounded search counts", async () => {
    expect(() => normalizeOptimizationInput({ ...search(), candidateCount: 125 }, model)).toThrow();
    let cancelled = false;
    const result = await executeOptimizationJob({ config: normalizeOptimizationInput(search(), model), model, simulateRun: (args) => { if (args.parameters.capacity === 0) throw new Error("candidate failure"); return simulateRun(args); }, shouldCancel: () => cancelled, onProgress: (update) => { if (update.progress.completed >= 40) cancelled = true; } });
    expect(result.status).toBe("cancelled"); expect(result.progress.failed).toBeGreaterThan(0); expect(result.progress.completed).toBeLessThan(1400);
  });
  test("saved API job manifest reproduces candidate summaries and cancel persists", async () => {
    const store = createMemoryDecisionStore();
    const handler = createOptimizationApiHandler({ model, simulateRun, optimizationStore: store, useWorker: false });
    try {
      const created = await api(handler, "/api/decision-optimizations", search()); expect(created.status).toBe(201);
      const id = created.body.job.id; await api(handler, `/api/decision-optimizations/${id}/start`, {});
      const done = await terminal(handler, `/api/decision-optimizations/${id}`, "job"); expect(done.status).toBe("completed");
      const manifest = (await api(handler, `/api/decision-optimizations/${id}/manifest`)).body;
      const next = await api(handler, "/api/decision-optimizations", { manifest }); expect(next.status).toBe(201);
      await api(handler, `/api/decision-optimizations/${next.body.job.id}/start`, {});
      const repeated = await terminal(handler, `/api/decision-optimizations/${next.body.job.id}`, "job"); expect(repeated.candidates).toEqual(done.candidates);
      const cancel = await api(handler, "/api/decision-optimizations", search()); await api(handler, `/api/decision-optimizations/${cancel.body.job.id}/start`, {}); await api(handler, `/api/decision-optimizations/${cancel.body.job.id}/cancel`, {});
      expect((await terminal(handler, `/api/decision-optimizations/${cancel.body.job.id}`, "job")).status).toBe("cancelled");
    } finally { await handler.close(); }
  });
});
describe("immutable timeline fork API", () => {
  test("preview/reject pure, approve binds seed/hash, protects placement/prefix and manifest lineage", async () => {
    const handler = createDecisionExperimentsHandler({ store: createMemoryDecisionStore() });
    try {
      const input = { schemaVersion: "decision-experiment.v1", name: "Fork source", modelVersion: housingModel.version, seed: 87, runs: 2, years: 4, scenarios: createHousingScenarios().slice(0, 2), metadata: { evidence: [{ label: "Synthetic test" }] } };
      input.scenarios[1].projects = [createBuildingProposal({ id: "existing", status: "approved", location: { x: 0, z: 0 } })];
      input.scenarios[1].stressPresets = ["recession"];
      const created = await api(handler, "/api/decision-experiments", input); expect(created.status).toBe(201);
      const id = created.body.experiment.id; await api(handler, `/api/decision-experiments/${id}/start`, {}); await terminal(handler, `/api/decision-experiments/${id}`, "experiment");
      const source = (await api(handler, `/api/decision-experiments/${id}/results`)).body; const bytes = JSON.stringify(source);
      const row = source.runs.find((run) => run.scenarioId === "plan-a");
      const summary = (await api(handler, `/api/decision-experiments/${id}/results?traces=summary`)).body;
      expect(summary.traceDelivery).toBe("on-demand");
      const projected = summary.runs.find((run) => run.id === row.id);
      expect(projected.monthlyTimeline).toBeUndefined(); expect(projected.monthlyTimelineCount).toBe(49);
      expect(projected.projects[0].states).toEqual([]); expect(projected.projects[0].stateCount).toBe(49);
      expect(projected.projects[0].finalState).toEqual(row.projects[0].states.at(-1));
      expect(projected.projects[0].events).toEqual(row.projects[0].events);
      expect(projected.projects[0].summary.schemaVersion).toBe("project-trace-summary.v1");
      expect(projected.projectMetrics).toEqual(row.projectMetrics);
      const compactAnalysis = analyzeBuildingProjects({ experiment: summary.experiment, runs: summary.runs, model: summary.model });
      const fullAnalysis = analyzeBuildingProjects({ experiment: source.experiment, runs: source.runs, model: source.model });
      // Delivery diagnostics intentionally differ; every timing, cost, outcome,
      // bottleneck and denominator fact must be identical.
      const facts = (analysis) => ({ ...analysis, projects: analysis.projects.map(({ fullTraceRuns, summaryRuns, ...project }) => ({ ...project, storedTraces: project.storedTraces.map(({ projection, ...trace }) => trace) })) });
      expect(facts(compactAnalysis)).toEqual(facts(fullAnalysis));
      expect(compactAnalysis.projects[0].summaryRuns).toBe(2); expect(compactAnalysis.projects[0].missingTraces).toBe(0);
      expect((await api(handler, projected.traceUrl)).body.run.monthlyTimeline).toEqual(row.monthlyTimeline);
      const body = { runId: row.id, month: 12, operations: [{ op: "set_parameter", target: "construction_capacity", value: 120000 }] };
      const preview = await api(handler, `/api/decision-experiments/${id}/forks`, body); expect(preview.body.preview).toBe(true);
      expect((await api(handler, `/api/decision-experiments/${id}/forks`)).body.forks).toEqual([]);
      expect((await api(handler, `/api/decision-experiments/${id}/forks`, { ...body, approval: true, previewHash: "bad" })).status).toBe(409);
      const forked = await api(handler, `/api/decision-experiments/${id}/forks`, { ...body, approval: true, previewHash: await hashWorldEditProposal(body) }); expect(forked.status).toBe(201);
      expect(forked.body.run.seed).toBe(row.seed); expect(forked.body.run.sampledParameters).toEqual(row.sampledParameters);
      expect(forked.body.run.monthlyTimeline.filter((entry) => entry.month <= 12)).toEqual(row.monthlyTimeline.filter((entry) => entry.month <= 12));
      expect(forked.body.experiment.metadata.evidence).toEqual(input.metadata.evidence); expect(forked.body.lineage.approval).toBe("explicit-user");
      expect(JSON.stringify((await api(handler, `/api/decision-experiments/${id}/results`)).body)).toBe(bytes);
      const overlap = { runId: row.id, month: 12, operations: [{ op: "add_building", target: "world.projects", value: createBuildingProposal({ status: "approved", location: { x: 0, z: 0 } }) }] };
      expect((await api(handler, `/api/decision-experiments/${id}/forks`, overlap)).status).toBe(400);
      const manifest = (await api(handler, `/api/decision-experiments/${forked.body.experiment.id}/manifest`)).body;
      const reproduced = await api(handler, "/api/decision-experiments", { manifest }); expect(reproduced.status).toBe(201);
      await api(handler, `/api/decision-experiments/${reproduced.body.experiment.id}/start`, {}); await terminal(handler, `/api/decision-experiments/${reproduced.body.experiment.id}`, "experiment");
      const replay = (await api(handler, `/api/decision-experiments/${reproduced.body.experiment.id}/results`)).body;
      expect(replay.runs[0].metrics).toEqual(forked.body.run.metrics); expect(replay.runs[0].projects).toEqual(forked.body.run.projects);
    } finally { await handler.close(); }
  });
});
