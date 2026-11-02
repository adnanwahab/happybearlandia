import { describe, expect, test } from "bun:test";
import { housingModel, createHousingScenarios, simulateHousingRun } from "../world/models/housing/index.js";
import { createBuildingProposal } from "../world/buildings/proposal.js";
import { validateWorldEdit } from "../world/ai/edit-validator.js";
import { applyApprovedWorldEdit, undoWorldEdit, restoreWorldRevision, hashWorldEditProposal } from "../world/ai/revisions.js";
import { normalizeDecisionInput, createDecisionManifest, DECISION_LIMITS } from "../world/decision/contracts.js";
import { executeDecisionExperiment, sampleDecisionParameters, aggregateDecisionResults } from "../world/decision/kernel.js";
import { createDecisionExperimentsHandler } from "../world/decision/api.js";
import { createMemoryDecisionStore } from "../world/decision/store.js";

const input = () => ({ schemaVersion: "decision-experiment.v1", name: "Build and edit", decision: "Add homes", modelId: housingModel.id, modelVersion: housingModel.version, seed: 42, runs: 2, years: 6, scenarios: createHousingScenarios().slice(0, 2), metadata: {} });
const edit = (operations, extra = {}) => ({ schemaVersion: "world-edit.v1", summary: "Reviewed input edit", operations, requiresSimulationRerun: true, warnings: [], baseRevision: "root", provider: "demo", model: "local-parser", prompt: "Change this input", ...extra });
const parameterEdit = () => edit([{ op: "set_parameter", target: "construction_capacity", value: 100000 }]);
const project = () => createBuildingProposal({ id: "tower", status: "approved" });

describe("pure edit previews and explicit approval", () => {
  test("preview/rejection preserve byte identity; approved parameter fixes effective uncertain input", async () => {
    const original = input(), proposal = parameterEdit();
    const bytes = JSON.stringify(original), proposalBytes = JSON.stringify(proposal);
    const checked = validateWorldEdit(proposal, { input: original, scenarioId: "plan-a" });
    expect(checked.valid).toBe(true); expect(JSON.stringify(original)).toBe(bytes); expect(JSON.stringify(proposal)).toBe(proposalBytes);
    expect(checked.warnings.some((warning) => warning.includes("fixed"))).toBe(true);
    for (const approval of [false, undefined, "true", { approved: true }]) {
      const result = await applyApprovedWorldEdit({ input: original, proposal: checked.proposal, scenarioId: "plan-a", approval });
      expect(JSON.stringify(result.input)).toBe(bytes); expect(result.revision).toBeNull();
    }
    const result = await applyApprovedWorldEdit({ input: original, proposal: checked.proposal, scenarioId: "plan-a", approval: true });
    const scenario = result.input.scenarios.find((row) => row.id === "plan-a");
    expect(sampleDecisionParameters(scenario.parameters, scenario.uncertainty, 99).construction_capacity).toBe(100000);
    expect(result.revision.proposalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.input.metadata.resultsStale).toBe(true);
    expect(JSON.stringify(original)).toBe(bytes);
  });
  test("stale preview detects revision and ordinary manual slider changes", async () => {
    const original = input();
    const checked = validateWorldEdit(parameterEdit(), { input: original, scenarioId: "plan-a" });
    const changed = structuredClone(original); changed.scenarios[1].parameters.permitting_months = 12;
    await expect(applyApprovedWorldEdit({ input: changed, proposal: checked.proposal, scenarioId: "plan-a", approval: true })).rejects.toThrow("Stale");
    const first = await applyApprovedWorldEdit({ input: original, proposal: checked.proposal, scenarioId: "plan-a", approval: true });
    await expect(applyApprovedWorldEdit({ input: first.input, proposal: checked.proposal, scenarioId: "plan-a", approval: true })).rejects.toThrow("Stale");
  });
  test("hash is canonical and arbitrary paths, code, evidence and unknown targets are rejected", async () => {
    expect(await hashWorldEditProposal({ a: 1, b: 2 })).toBe(await hashWorldEditProposal({ b: 2, a: 1 }));
    for (const operation of [
      { op: "set_parameter", target: "metadata.evidence", value: 1 },
      { op: "set_parameter", target: "__proto__.polluted", value: 1 },
      { op: "change_equation", target: "world", value: "alert(1)" },
      { op: "set_parameter", target: "migration", value: 1, path: "/tmp/private" },
      { op: "add_scenario", target: "scenarios", value: { evidence: [] } },
      { op: "set_parameter", target: "migration" },
    ]) expect(validateWorldEdit(edit([operation]), { input: input(), scenarioId: "plan-a" }).valid).toBe(false);
    expect({}.polluted).toBeUndefined();
  });
});

describe("immutable world revision history", () => {
  test("undo and restore append snapshots while retaining all original history", async () => {
    const original = input();
    const first = await applyApprovedWorldEdit({ input: original, proposal: parameterEdit(), scenarioId: "plan-a", approval: true });
    const firstBytes = JSON.stringify(first.input);
    const undone = await undoWorldEdit({ input: first.input, approval: true });
    expect(undone.input.scenarios).toEqual(original.scenarios);
    expect(undone.input.metadata.worldEditHistory).toHaveLength(2);
    expect(undone.revision.parent).toBe(first.revision.id);
    expect(undone.input.metadata.worldEditHistory[0]).toEqual(first.input.metadata.worldEditHistory[0]);
    expect(JSON.stringify(first.input)).toBe(firstBytes);
    const restored = await restoreWorldRevision({ input: undone.input, revisionId: first.revision.id, approval: true });
    expect(restored.input.scenarios).toEqual(first.input.scenarios);
    expect(restored.input.metadata.worldEditHistory).toHaveLength(3);
    expect(Object.isFrozen(restored.input.metadata.worldEditHistory[0])).toBe(true);
  });
  test("visual-only edit leaves simulation inputs/seeds exact and does not require rerun", async () => {
    const original = input();
    const result = await applyApprovedWorldEdit({ input: original, proposal: edit([{ op: "change_world_visual", target: "skyColor", value: "#102030" }]), scenarioId: "plan-a", approval: true });
    expect(result.revision.requiresSimulationRerun).toBe(false);
    expect(result.input.scenarios[1].parameters).toEqual(original.scenarios[1].parameters);
    expect(result.input.seed).toBe(original.seed);
    const a = executeDecisionExperiment({ experiment: original, model: housingModel, simulateRun: simulateHousingRun });
    const b = executeDecisionExperiment({ experiment: result.input, model: housingModel, simulateRun: simulateHousingRun });
    expect((await a).runs.map((row) => row.metrics)).toEqual((await b).runs.map((row) => row.metrics));
  });
});

describe("project contracts and success criteria", () => {
  test("timed stress is retained and starts at its recorded month rather than month zero", async () => {
    const original = input();
    const approved = await applyApprovedWorldEdit({ input: original, scenarioId: "plan-a", approval: true, proposal: edit([{ op: "apply_stress_preset", target: "stressPresets", value: { presetId: "recession", startMonth: 36 } }]) });
    expect(approved.input.scenarios[1].scheduledStress).toEqual([{ presetId: "recession", startMonth: 36 }]);
    const output = await executeDecisionExperiment({ experiment: approved.input, model: housingModel, simulateRun: simulateHousingRun });
    const row = output.runs.find((run) => run.scenarioId === "plan-a");
    expect(row.status).toBe("completed");
    expect(row.events.find((event) => event.type === "STRESS_PRESET_STARTED").month).toBe(36);
    const before = simulateHousingRun({ parameters: row.sampledParameters, seed: row.seed, years: original.years });
    expect(row.timeline.filter((entry) => entry.year < 3)).toEqual(before.timeline.filter((entry) => entry.year < 3));
    expect(row.metrics).not.toEqual(before.metrics);
  });
  test("approved projects, visuals, criteria and revisions survive manifest normalization", async () => {
    const original = input();
    const result = await applyApprovedWorldEdit({ input: original, scenarioId: "plan-a", approval: true, proposal: edit([
      { op: "add_building", target: "projects", value: project() },
      { op: "change_success_criterion", target: "successCriterion", value: { metricId: "median_rent", operator: "lte", value: 2500 } },
    ]) });
    const normalized = normalizeDecisionInput(result.input, housingModel);
    expect(normalized.scenarios[1].projects[0].status).toBe("approved");
    expect(normalizeDecisionInput(createDecisionManifest(normalized, housingModel), housingModel)).toEqual(normalized);
    const output = await executeDecisionExperiment({ experiment: normalized, model: housingModel, simulateRun: simulateHousingRun });
    const run = output.runs.find((row) => row.scenarioId === "plan-a");
    expect(run.projects[0].states).toHaveLength(original.years * 12 + 1);
    expect(run.projectMetrics).toBeDefined();
    const rows = output.runs.filter((row) => row.scenarioId === "plan-a" && row.status === "completed");
    expect(output.aggregates[1].successShare).toBe(rows.filter((row) => row.metrics.median_rent <= 2500).length / rows.length);
  });
  test("success share uses only observed successful runs", () => {
    const experiment = input(); experiment.scenarios[1].successCriterion = { metricId: "median_rent", operator: "lte", value: 2000 };
    const result = aggregateDecisionResults({ experiment, model: housingModel, runs: [
      { scenarioId: "plan-a", status: "completed", metrics: { median_rent: 1800 } },
      { scenarioId: "plan-a", status: "completed", metrics: { median_rent: 2400 } },
      { scenarioId: "plan-a", status: "failed", metrics: {} },
    ] });
    expect(result.aggregates[1].successShare).toBe(.5); expect(result.aggregates[1].evaluatedCount).toBe(2);
  });
  test("monthly project-state budget rejects oversized workloads without discarding states", () => {
    const oversized = input(); oversized.runs = 1000; oversized.years = 10;
    oversized.scenarios[1].projects = Array.from({ length: 5 }, (_, index) => createBuildingProposal({ id: `project_${index}`, location: { x: index * 200, z: 0 }, status: "approved" }));
    expect(DECISION_LIMITS.maxProjectStates).toBe(200000);
    expect(() => normalizeDecisionInput(oversized, housingModel)).toThrow("monthly states");
    oversized.runs = 500;
    oversized.scenarios[1].projects = oversized.scenarios[1].projects.slice(0, 3);
    expect(() => normalizeDecisionInput(oversized, housingModel)).not.toThrow();
  });
});

async function runApi(handler, path = "", method = "GET", body) {
  const response = await handler(new Request(`http://local/api/decision-experiments${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) }));
  return { status: response.status, body: await response.json() };
}
async function awaitApi(handler, id) {
  for (let index = 0; index < 200; index++) {
    const { body } = await runApi(handler, `/${id}`);
    if (["completed", "failed", "cancelled"].includes(body.experiment.status)) return body.experiment;
    await Bun.sleep(2);
  }
  throw new Error("Experiment timed out");
}
describe("versioned API and project serialization", () => {
  test("visual-revision copies completed outcomes without a rerun, preserving source and rejecting math tampering", async () => {
    const handler = createDecisionExperimentsHandler({ store: createMemoryDecisionStore() });
    try {
      const created = await runApi(handler, "", "POST", input());
      const id = created.body.experiment.id;
      await runApi(handler, `/${id}/start`, "POST"); await awaitApi(handler, id);
      const source = (await runApi(handler, `/${id}/results`)).body;
      const sourceBytes = JSON.stringify(source);
      const visual = await applyApprovedWorldEdit({ input: source.experiment, scenarioId: "plan-a", approval: true, proposal: edit([{ op: "change_world_visual", target: "skyColor", value: "#123456" }]) });
      const saved = await runApi(handler, `/${id}/visual-revision`, "POST", { input: visual.input });
      expect(saved.status).toBe(201);
      expect(saved.body.experiment.id).not.toBe(id);
      expect(saved.body.experiment.resultsSourceExperimentId).toBe(id);
      expect(saved.body.experiment.scenarios[1].worldVisuals.skyColor).toBe("#123456");
      expect(saved.body.runs.map(({ metrics, seed, timeline }) => ({ metrics, seed, timeline }))).toEqual(source.runs.map(({ metrics, seed, timeline }) => ({ metrics, seed, timeline })));
      expect(JSON.stringify((await runApi(handler, `/${id}/results`)).body)).toBe(sourceBytes);
      const tampered = structuredClone(visual.input); tampered.scenarios[1].parameters.construction_capacity += 1000;
      expect((await runApi(handler, `/${id}/visual-revision`, "POST", { input: tampered })).status).toBe(400);
      const unapproved = input(); unapproved.scenarios[1].worldVisuals = { skyColor: "#123456" };
      expect((await runApi(handler, `/${id}/visual-revision`, "POST", { input: unapproved })).status).toBe(400);
      const shared = (await runApi(handler, `/${saved.body.experiment.id}/share`)).body;
      expect(shared.experiment.scenarios[1].worldVisuals.skyColor).toBe("#123456");
      const manifest = (await runApi(handler, `/${saved.body.experiment.id}/manifest`)).body;
      expect(manifest.experiment.metadata.resultsSourceExperimentId).toBe(id);
    } finally { await handler.close(); }
  });
  test("old frozen manifests run original model and completed rows stay immutable", async () => {
    const legacy = await import("../world/models/housing/legacy-v1.js");
    const handler = createDecisionExperimentsHandler({ store: createMemoryDecisionStore() });
    try {
      const original = { ...input(), modelVersion: "1.0.0", scenarios: legacy.createHousingScenarios().slice(0, 2) };
      const manifest = createDecisionManifest(original, legacy.housingModel);
      const created = await runApi(handler, "", "POST", { manifest }); expect(created.status).toBe(201);
      const id = created.body.experiment.id;
      await runApi(handler, `/${id}/start`, "POST"); expect((await awaitApi(handler, id)).status).toBe("completed");
      const result = (await runApi(handler, `/${id}/results`)).body;
      expect(result.model.version).toBe("1.0.0");
      const run = result.runs[0];
      expect(run.metrics).toEqual(legacy.simulateHousingRun({ parameters: run.sampledParameters, seed: run.seed, years: original.years }).metrics);
      expect((await runApi(handler, `/${id}/start`, "POST")).status).toBe(409);
      expect((await runApi(handler, `/${id}/manifest`)).body.modelVersion).toBe("1.0.0");
    } finally { await handler.close(); }
  });
});
