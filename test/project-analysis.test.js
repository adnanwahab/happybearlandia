import { describe, expect, test } from "bun:test";
import { analyzeBuildingProjects, analyzeSuccessCriteria, storedProjectTrace, summarizeStoredProject, worldEditProvenance } from "../world/buildings/project-analysis.js";
import { analyzeDecision } from "../world/decision/analysis.js";
import { buildDecisionManifest, renderDecisionBrief } from "../world/decision/brief.js";

const proposal = { schemaVersion: "building-proposal.v1", id: "tower", name: "Station tower", status: "approved", location: { districtId: "station", x: 50, z: 50, rotation: 0 }, program: { residentialUnits: 100, affordableUnits: 40 }, geometry: { floors: 12, footprintSqFt: 8000, heightMeters: 43 }, finance: { estimatedCost: 10000000, publicSubsidy: 2000000 }, construction: { permitMonths: 2, buildMonths: 6 } };
const experiment = { id: "building-test", schemaVersion: "decision-experiment.v1", modelId: "housing.v1", modelVersion: "1.1.0", name: "Projects and policy", decision: "Test a station tower", status: "completed", seed: 42, runs: 4, years: 2, scenarios: [{ id: "base", kind: "baseline", name: "Current policy", parameters: {}, projects: [] }, { id: "plan", kind: "plan-a", name: "Tower + policy", parameters: { zoning_density: 1.2 }, projects: [proposal], successCriterion: { metricId: "housing_supply", operator: "gte", value: 1050 }, worldVisuals: { skyColor: "#223344" } }], metadata: {} };
const model = { id: "housing.v1", version: "1.1.0", parameters: [], metrics: [{ id: "housing_supply", label: "Housing supply", unit: "homes", direction: "higher" }], limitations: [] };
const initial = { month: 0, status: "approved", completedUnits: 0, occupiedUnits: 0, affordableUnits: 0, publicCost: 0, privateCost: 0, totalCost: 0, cumulativeCapacityUsed: 0 };
const capacityEvent = { month: 5, type: "PROJECT_DELAYED", projectId: "tower", cause: "capacity-shortage", message: "Delayed by construction capacity." };
function project(states, events = []) { return { projectId: "tower", states: [initial, ...states], events }; }
const runs = [1, 2, 3, 4].map(seed => ({ id: `base-${seed}`, scenarioId: "base", seed, status: "completed", metrics: { housing_supply: 1000 } })).concat([
  { id: "plan-1", scenarioId: "plan", seed: 1, status: "completed", metrics: { housing_supply: 1080 }, projects: [project([{ month: 10, status: "complete", completedUnits: 100, affordableUnits: 40, occupiedUnits: 0, publicCost: 2000000, privateCost: 10000000, totalCost: 12000000, cumulativeCapacityUsed: 100 }, { month: 24, status: "occupied", completedUnits: 100, affordableUnits: 40, occupiedUnits: 100, publicCost: 2000000, privateCost: 10000000, totalCost: 12000000, cumulativeCapacityUsed: 100 }], [capacityEvent])], events: [capacityEvent] },
  { id: "plan-2", scenarioId: "plan", seed: 2, status: "completed", metrics: { housing_supply: 1000 }, projects: [project([{ month: 4, status: "cancelled", completedUnits: 0, occupiedUnits: 0, affordableUnits: 0, publicCost: 500000, privateCost: 1000000, totalCost: 1500000, cumulativeCapacityUsed: 25 }])] },
  { id: "plan-3", scenarioId: "plan", seed: 3, status: "completed", metrics: { housing_supply: 1010 }, projects: [project([{ month: 24, status: "structure", completedUnits: 0, occupiedUnits: 0, affordableUnits: 0, publicCost: 250000, privateCost: 1000000, totalCost: 1250000, cumulativeCapacityUsed: 10, capacityShortfall: 2 }])] },
  { id: "plan-4", scenarioId: "plan", seed: 4, status: "completed", metrics: { housing_supply: 999 } },
  { id: "plan-failed", scenarioId: "plan", seed: 99, status: "failed", metrics: { housing_supply: -100 }, projects: [project([{ month: 1, status: "complete", completedUnits: 100 }])] },
]);

describe("stored project analysis", () => {
  test("timing conditions on completed runs and reports censoring, missing traces and denominators", () => {
    const before = JSON.stringify({ experiment, runs });
    const output = analyzeBuildingProjects({ experiment, runs, model });
    const row = output.projects[0];
    expect(row.observedRuns).toBe(3);
    expect(row.eligibleRuns).toBe(3);
    expect(row.missingTraces).toBe(1);
    expect(row.completionProbability).toBeCloseTo(1 / 3);
    expect(row.cancellationProbability).toBeCloseTo(1 / 3);
    expect(row.unresolvedCount).toBe(1);
    expect(row.completionMonths).toMatchObject({ count: 1, median: 10, p10: 10, p90: 10 });
    expect(row.delayMonths.median).toBe(2);
    expect(row.directCompletedUnits).toMatchObject({ count: 3, median: 0, max: 100 });
    expect(row.directAffordableUnits.max).toBe(40);
    expect(JSON.stringify({ experiment, runs })).toBe(before);
  });
  test("estimated cost, authorized subsidy, realized spending and capacity traces stay distinct", () => {
    const row = analyzeBuildingProjects({ experiment, runs, model }).projects[0];
    expect(row.estimatedTotalCost).toBe(10000000);
    expect(row.authorizedPublicSubsidy).toBe(2000000);
    expect(row.actualPublicCost.mean).toBeCloseTo(2750000 / 3);
    expect(row.actualTotalCost.max).toBe(12000000);
    expect(row.actualPrivateCost.max).toBe(10000000);
    expect(row.capacityBottleneck.prevalence).toBeCloseTo(2 / 3);
    expect(row.capacityBottleneck.traces[0].events).toHaveLength(1);
    expect(storedProjectTrace(runs[4], "tower").events).toHaveLength(1);
  });
  test("remaining stock difference is computed only from observed same-seed direct delivery", () => {
    const output = analyzeBuildingProjects({ experiment, runs, model });
    const comparison = output.scenarios.find(row => row.scenarioId === "plan");
    expect(comparison.pairedCount).toBe(4);
    expect(comparison.matchedRuns.find(row => row.seed === 1)).toMatchObject({ housingDelta: 80, directProjectDelta: 100, remainingStockDelta: -20 });
    expect(comparison.matchedRuns.find(row => row.seed === 4).remainingStockDelta).toBeNull();
    expect(comparison.remainingStockDelta.count).toBe(3);
    expect(comparison.comparisonMethod).toContain("not an isolated");
  });
  test("proposed/pre-cancelled inputs are excluded from cancellation-risk denominators", () => {
    for (const status of ["proposed", "cancelled"]) {
      const input = { ...experiment, scenarios: [{ ...experiment.scenarios[1], projects: [{ ...proposal, status }] }] };
      const observed = [{ ...runs[4], projects: [project([{ ...initial, status, month: 24 }])] }];
      observed[0].projects[0].states[0] = { ...initial, status };
      const row = analyzeBuildingProjects({ experiment: input, runs: observed, model }).projects[0];
      expect(row.completionProbability).toBeNull();
      expect(row.cancellationProbability).toBeNull();
      expect(row.directCompletedUnits.mean).toBe(0);
    }
    const unknown = analyzeBuildingProjects({ experiment, runs: [runs[7]], model }).projects[0];
    expect(unknown.actualTotalCost.mean).toBeNull();
    expect(unknown.directCompletedUnits.mean).toBeNull();
  });
  test("explicit compact summaries preserve timing, cancellation, spending and bottleneck facts without fake replay states", () => {
    const full = analyzeBuildingProjects({ experiment, runs, model });
    const projected = runs.map(run => ({ ...run, traceDelivery: "on-demand", traceUrl: `/api/decision-experiments/e/runs/${run.id}`, projects: run.projects?.map(project => ({ ...project, states: [], projection: "summary", summary: summarizeStoredProject(project) })) }));
    const compact = analyzeBuildingProjects({ experiment, runs: projected, model });
    const expected = full.projects[0], actual = compact.projects[0];
    for (const key of ["observedRuns", "eligibleRuns", "missingTraces", "completionCount", "cancellationCount", "completionProbability", "cancellationProbability", "unresolvedCount", "completionMonths", "delayMonths", "directCompletedUnits", "directAffordableUnits", "actualPublicCost", "actualPrivateCost", "actualTotalCost", "capacityUsed"]) expect(actual[key]).toEqual(expected[key]);
    expect(actual.capacityBottleneck.prevalence).toBe(expected.capacityBottleneck.prevalence);
    expect(actual.summaryRuns).toBe(3);
    expect(actual.fullTraceRuns).toBe(0);
    expect(storedProjectTrace(projected[4], "tower").states).toBeNull();
    expect(storedProjectTrace(projected[4], "tower").summary.completionMonth).toBe(10);
    const report = renderDecisionBrief({ experiment, runs: projected, model, traceDelivery: "on-demand" });
    expect(report).toContain("Compact summaries retain actual first-completion");
    expect(report).toContain("not a full offline replay-trace archive");
    expect(buildDecisionManifest({ experiment, runs: projected, model }).runManifest[4].traceUrl).toContain("/plan-1");
  });

  test("a projected last state without timing summary cannot masquerade as a complete trace", () => {
    const fake = { ...runs[4], traceDelivery: "on-demand", projects: [{ projectId: "tower", projection: "summary", states: [runs[4].projects[0].states.at(-1)], finalState: runs[4].projects[0].states.at(-1) }] };
    expect(storedProjectTrace(fake, "tower")).toBeNull();
    const analysis = analyzeBuildingProjects({ experiment, runs: [fake], model });
    expect(analysis.projects[0].completionMonths.count).toBe(0);
    expect(analysis.projects[0].unresolvedCount).toBe(0);
    expect(analysis.projects[0].completionProbability).toBeNull();
  });

  test("success share uses explicit thresholds, excludes failed and missing numeric metrics", () => {
    const result = analyzeSuccessCriteria({ experiment, runs: [...runs, { id: "missing", status: "completed", scenarioId: "plan", metrics: {} }] });
    const plan = result.find(row => row.scenarioId === "plan");
    expect(plan.count).toBe(4);
    expect(plan.successful).toBe(1);
    expect(plan.share).toBe(0.25);
    expect(plan.missing).toBe(1);
    expect(result[0].status).toBe("not-defined");
    const lower = structuredClone(experiment); lower.scenarios[1].successCriterion = { metricId: "housing_supply", operator: "lte", value: 1000 };
    expect(analyzeSuccessCriteria({ experiment: lower, runs })[1].share).toBe(0.5);
  });
});

describe("project/report provenance", () => {
  const attack = '<img src=x onerror="alert(1)">';
  const revision = { id: "revision-1", parent: "root", provider: "demo", model: "local-parser.v1", prompt: attack, summary: "Add station housing", operations: [{ op: "add_building", target: "world.projects", value: { ...proposal, name: attack } }], approvedAt: "2026-11-02T12:00:00.000Z", proposalHash: "a".repeat(64), requiresSimulationRerun: true, kind: "edit" };
  const revised = { ...experiment, metadata: { worldRevision: revision, worldEditHistory: [{ ...revision, before: { privateSnapshot: "do not repeat in report" }, after: { privateSnapshot: "do not repeat in report" } }] } };
  test("retains actual provider/model/time/hash without copying history snapshots into the display", () => {
    const audit = worldEditProvenance(revised.metadata);
    expect(audit.records[0]).toMatchObject({ approved: true, approvedAt: revision.approvedAt, provider: "demo", model: "local-parser.v1", parent: "root", proposalHash: revision.proposalHash });
    expect(JSON.stringify(audit)).not.toContain("privateSnapshot");
    expect(audit.notice).toContain("does not independently verify");
  });
  test("analysis, brief and manifest preserve projects, states, approved revisions and escaping", () => {
    const input = { experiment: revised, runs, model };
    const analysis = analyzeDecision(input);
    expect(analysis.projectAnalysis.projects).toHaveLength(1);
    const report = renderDecisionBrief(input);
    expect(report).toContain("Construction outcomes and timing");
    expect(report).toContain("Approved world edits / provenance");
    expect(report).toContain("descriptive residual");
    expect(report).toContain("local-parser.v1");
    expect(report).not.toContain(attack);
    expect(report).not.toContain("privateSnapshot");
    const manifest = buildDecisionManifest(input);
    expect(manifest.experiment.scenarios[1].projects).toEqual([proposal]);
    expect(manifest.experiment.metadata.worldRevision.proposalHash).toBe(revision.proposalHash);
    expect(manifest.runManifest[4].projects[0].states.at(-1).completedUnits).toBe(100);
    expect(manifest.experiment.scenarios[1].successCriterion.value).toBe(1050);
    expect(manifest.reproduction.exactRun).toContain("approved project inputs");
  });

  test("visual revision reports immutable source rows without implying a new simulation", () => {
    const input = { experiment: { ...revised, id: "visual-copy", metadata: { ...revised.metadata, resultsSourceExperimentId: "original-run" } }, runs: runs.map(run => ({ ...run, experimentId: "visual-copy", resultsSourceExperimentId: "original-run" })), model };
    const analysis = analyzeDecision(input);
    expect(analysis.worldEditAudit.resultsSourceExperimentId).toBe("original-run");
    const report = renderDecisionBrief(input);
    expect(report).toContain("no new simulation ran for the visual edit");
    expect(report).toContain("original-run");
    const manifest = buildDecisionManifest(input);
    expect(manifest.experiment.metadata.resultsSourceExperimentId).toBe("original-run");
    expect(manifest.runManifest[0].resultsSourceExperimentId).toBe("original-run");
    expect(manifest.runManifest[0].experimentId).toBe("visual-copy");
  });

  test("consumes actual approved revision and housing/kernel lifecycle outputs", async () => {
    const { housingModel, createHousingScenarios, simulateHousingRun, applyStressPresets } = await import("../world/models/housing/index.js");
    const { createBuildingProposal } = await import("../world/buildings/proposal.js");
    const { applyApprovedWorldEdit } = await import("../world/ai/revisions.js");
    const { executeDecisionExperiment } = await import("../world/decision/kernel.js");
    const scenarios = createHousingScenarios().slice(0, 2).map(scenario => ({ ...scenario, projects: [] }));
    const draft = { schemaVersion: "decision-experiment.v1", name: "Actual housing project analysis", decision: "Compare named project and policy", modelId: housingModel.id, modelVersion: housingModel.version, seed: 42, runs: 10, years: 8, scenarios, metadata: {} };
    const building = createBuildingProposal({ id: "analysis-tower", status: "proposed", construction: { permitMonths: 2, buildMonths: 12 } });
    const proposal = { schemaVersion: "world-edit.v1", baseRevision: "root", provider: "demo", model: "local-parser.v1", prompt: "Add station housing", summary: "Add project for analysis", operations: [{ op: "add_building", target: "world.projects", value: building }], requiresSimulationRerun: true, warnings: [] };
    const approved = await applyApprovedWorldEdit({ input: draft, proposal, scenarioId: scenarios[1].id, approval: true });
    const output = await executeDecisionExperiment({ experiment: approved.input, model: housingModel, simulateRun: simulateHousingRun, applyStressPresets });
    const report = analyzeDecision({ experiment: approved.input, runs: output.runs, model: housingModel, aggregates: output.aggregates, comparisons: output.comparisons });
    const actual = report.projectAnalysis.projects[0];
    expect(output.progress.failed).toBe(0);
    expect(actual.observedRuns).toBe(10);
    expect(actual.completionMonths.count + actual.cancellationCount + actual.unresolvedCount).toBe(10);
    expect(actual.actualPublicCost.max).toBeLessThanOrEqual(building.finance.publicSubsidy);
    expect(actual.actualTotalCost.count).toBe(10);
    expect(report.worldEditAudit.records[0].approvedAt).toBe(approved.revision.approvedAt);
    expect(report.worldEditAudit.records[0].proposalHash).toBe(approved.revision.proposalHash);
    expect(report.worldEditAudit.records[0].approved).toBe(true);
    expect(renderDecisionBrief({ experiment: approved.input, runs: output.runs, model: housingModel })).toContain("analysis-tower");
  });
});
