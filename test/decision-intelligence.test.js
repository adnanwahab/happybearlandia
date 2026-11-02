import { describe, expect, test } from "bun:test";
import { analyzeIntelligence, classifyOutcomes, compareExperiments, descriptiveBins, descriptiveSensitivity, decisionIntelligenceProvenance, explainFuture, mineOutcomeRules, proposeRuleFix, queryFuture, runPartialDependence } from "../world/decision/intelligence.js";
import { housingModel, createHousingScenarios, simulateHousingRun } from "../world/models/housing/index.js";
import { runHousingCounterfactual, explainHousingRun } from "../world/models/housing/counterfactual.js";
import { validateWorldEdit } from "../world/ai/edit-validator.js";
import { normalizeDecisionInput } from "../world/decision/contracts.js";
import { causalGraphSvg } from "../world/decision/intelligence-view.js";
import { renderDecisionBrief, buildDecisionManifest } from "../world/decision/brief.js";
import { fingerprintWorldInput } from "../world/ai/edit-schema.js";
import { housingCausalRegistry } from "../world/models/housing/causal-registry.js";

const experiment = normalizeDecisionInput({ name: "Rule fixture", modelId: housingModel.id, modelVersion: housingModel.version, runs: 20, years: 5, seed: 42, scenarios: [
  { id: "baseline", kind: "baseline", name: "Current", parameters: {} },
  { id: "plan", kind: "plan-a", name: "Policy", parameters: { construction_capacity: 72000 }, uncertainty: { construction_capacity: { type: "uniform", min: 1000, max: 300000 } }, successCriterion: { metricId: "affordability", operator: "gte", value: 50 } },
] }, housingModel);
experiment.id = "rules-source";
const runs = Array.from({ length: 20 }, (_, index) => ({ id: `p${index}`, scenarioId: "plan", seed: index, modelVersion: housingModel.version, status: "completed", sampledParameters: { ...experiment.scenarios[1].parameters, construction_capacity: (index + 1) * 10000 }, metrics: { affordability: index < 10 ? 40 : 60 }, drivers: [{ id: "recorded", label: "Stored mechanism", value: index, unit: "index" }], events: [{ type: "capacity-bound", label: "Recorded event" }] }));

describe("within-scenario failure and success rules", () => {
  test("support, base rate, confidence and lift use actual denominators", () => {
    const classified = classifyOutcomes({ experiment, runs, model: housingModel });
    const rules = mineOutcomeRules({ classified, model: housingModel });
    const rule = rules.find(row => row.conditions[0].parameterId === "construction_capacity");
    expect(rule.populationCount).toBe(20);
    expect(rule.targetCount).toBe(10);
    expect(rule.count).toBe(5);
    expect(rule.outcomeCount).toBe(5);
    expect(rule.support).toBe(0.25);
    expect(rule.baseRate).toBe(0.5);
    expect(rule.conditionalRate).toBe(1);
    expect(rule.lift).toBe(2);
    expect(rule.prevalenceInTarget).toBe(0.5);
    expect(mineOutcomeRules({ classified, model: housingModel, target: "success" })[0].conditions[0].operator).toBe("gte");
    expect(mineOutcomeRules({ classified, model: housingModel, minCount: 11 })).toEqual([]);
    expect(mineOutcomeRules({ classified, model: housingModel, minSupport: 0.3 })).toEqual([]);
  });
  test("without explicit criteria recorded outcomes stay unclassified until diagnostic mode is selected", () => {
    const source = structuredClone(experiment); delete source.scenarios[1].successCriterion;
    const baseline = runs.map(row => ({ ...row, id: `base-${row.id}`, scenarioId: "baseline", metrics: { affordability: 50 } }));
    const recorded = classifyOutcomes({ experiment: source, runs: [...baseline, ...runs], model: housingModel });
    expect(recorded.every(row => row.outcome === "unclassified")).toBe(true);
    const diagnostic = classifyOutcomes({ experiment: source, runs: [...baseline, ...runs], model: housingModel, mode: "paired-baseline" });
    expect(diagnostic.filter(row => row.outcome === "failure")).toHaveLength(10);
    expect(diagnostic.find(row => row.outcome === "failure").definition).toContain("same-seed");
  });

  test("rules stay within scenario and omit numerical failures / missing outcomes", () => {
    const other = runs.map(row => ({ ...row, scenarioId: "other", id: `other-${row.id}`, metrics: { affordability: 100 } }));
    const input = { ...experiment, scenarios: [...experiment.scenarios, { ...experiment.scenarios[1], id: "other" }] };
    const classified = classifyOutcomes({ experiment: input, runs: [...runs, ...other, { ...runs[0], id: "failed", status: "failed" }, { ...runs[0], id: "missing", metrics: {} }], model: housingModel });
    expect(classified).toHaveLength(40);
    const rules = mineOutcomeRules({ classified, model: housingModel });
    expect(rules.every(row => row.scenarioId === "plan" && row.populationCount === 20)).toBe(true);
    expect(mineOutcomeRules({ classified: classified.slice(0, 2), model: housingModel })).toEqual([]);
  });
  test("shared multi-outcome classifier retains mixed outcomes and failure precedence", () => {
    const input = structuredClone(experiment);
    delete input.scenarios[1].successCriterion;
    input.scenarios[1].outcomeCriteria = { success: [{ metricId: "affordability", operator: "gte", value: 60 }], failure: [{ metricId: "affordability", operator: "lte", value: 40 }] };
    const rows = [30, 50, 70].map((value, index) => ({ ...runs[index], metrics: { affordability: value } }));
    expect(classifyOutcomes({ experiment: input, runs: rows, model: housingModel }).map(row => row.outcome)).toEqual(["failure", "mixed", "success"]);
  });
});

describe("test-a-fix and trust boundaries", () => {
  test("fix is bounded, validated, scenario-scoped and leaves input and results byte-identical", () => {
    const before = JSON.stringify({ experiment, runs });
    const analysis = analyzeIntelligence({ input: experiment, results: { experiment, runs, model: housingModel } });
    const rule = analysis.failureRules.find(row => row.conditions[0].parameterId === "construction_capacity");
    const proposal = proposeRuleFix({ rule, input: experiment, model: housingModel });
    expect(proposal.schemaVersion).toBe("world-edit.v1");
    expect(proposal.scenarioId).toBe("plan");
    expect(proposal.provider).toBe("local-analysis");
    expect(proposal.operations[0].value).toBeGreaterThan(experiment.scenarios[1].parameters.construction_capacity);
    expect(proposal.operations[0].value).toBeLessThanOrEqual(300000);
    expect(proposal.warnings.join(" ")).toContain("Explicit human approval");
    expect(validateWorldEdit(proposal, { input: experiment, scenarioId: "plan" }).valid).toBe(true);
    expect(JSON.stringify({ experiment, runs })).toBe(before);
    expect(() => proposeRuleFix({ rule: { ...rule, conditions: [{ parameterId: "interest_rate" }] }, input: experiment, model: housingModel })).toThrow("external assumptions");
  });
  test("sensitivity and descriptive bins do not masquerade as variance / partial dependence", () => {
    const sensitivity = descriptiveSensitivity({ runs, model: housingModel, scenarioId: "plan", metricId: "affordability" });
    expect(sensitivity[0].parameterId).toBe("construction_capacity");
    expect(sensitivity[0].method).toContain("not a causal");
    const bins = descriptiveBins({ runs, scenarioId: "plan", parameterId: "construction_capacity", metricId: "affordability" });
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(20);
    expect(bins[0].method).toContain("NOT partial dependence");
    const result = analyzeIntelligence({ results: { experiment, runs, model: housingModel } });
    expect(result.varianceDecomposition.available).toBe(false);
    expect(result.verify[0].lowConfidence).toBe(true);
    expect(result.verify[0].rationale).toContain("not statistical");
  });
  test("before/after pairs scenario and seed, rejecting version/horizon mismatch", () => {
    const current = { experiment, runs: runs.map(row => ({ ...row, metrics: { affordability: row.metrics.affordability + 3 } })) };
    const previous = { experiment: { ...experiment, id: "previous" }, runs };
    const comparison = compareExperiments({ current, previous, model: housingModel });
    expect(comparison.available).toBe(true);
    expect(comparison.pairs).toBe(20);
    expect(comparison.metrics.find(row => row.metricId === "affordability").medianDelta).toBe(3);
    const unchanged = runs.map(row => ({ ...row, id: `b-${row.id}`, scenarioId: "baseline" }));
    const split = compareExperiments({ current: { ...current, runs: [...current.runs, ...unchanged] }, previous: { ...previous, runs: [...runs, ...unchanged] }, model: housingModel });
    expect(split.metrics.find(row => row.scenarioId === "plan" && row.metricId === "affordability").medianDelta).toBe(3);
    expect(split.metrics.find(row => row.scenarioId === "baseline" && row.metricId === "affordability").medianDelta).toBe(0);
    expect(compareExperiments({ current, previous: { ...previous, experiment: { ...previous.experiment, modelVersion: "1.0.0" } }, model: housingModel }).available).toBe(false);
  });
});

describe("numeric explanations and queries", () => {
  const scenarios = createHousingScenarios().slice(0, 2);
  const actual = scenarios.map((scenario, index) => ({ ...simulateHousingRun({ parameters: scenario.parameters, seed: 42, years: 4 }), id: `actual-${index}`, scenarioId: scenario.id, status: "completed", seed: 42, sampledParameters: scenario.parameters, modelVersion: housingModel.version }));
  test("partial dependence executes interventions and rejects mismatched reconstruction", async () => {
    let calls = 0;
    const result = await runPartialDependence({ runs: [actual[1]], parameterId: "construction_capacity", metricId: "housing_supply", values: [72000, 96000], rerun(args) { calls++; return runHousingCounterfactual({ ...args, scenario: scenarios[1], years: 4 }); } });
    expect(calls).toBe(2);
    expect(result.executions).toBe(2);
    expect(result.points.every(point => Number.isFinite(point.mean))).toBe(true);
    await expect(runPartialDependence({ runs: [actual[1]], parameterId: "construction_capacity", metricId: "housing_supply", values: [72000], rerun() { return { metrics: { housing_supply: 1 }, recordedMismatch: ["housing_supply"] }; } })).rejects.toThrow("mismatch");
    const abort = new AbortController(); abort.abort();
    await expect(runPartialDependence({ runs: [actual[1]], values: [1], rerun() {}, signal: abort.signal })).rejects.toThrow("cancelled");
  });
  test("top-five numerical reasons come from versioned model reversions; queries quote actual values", () => {
    const attribution = explainHousingRun({ run: actual[1], scenario: scenarios[1], baselineRun: actual[0], baselineScenario: scenarios[0], years: 4, metricId: "affordability" });
    const output = explainFuture({ run: actual[1], referenceRun: actual[0], attribution, metricId: "affordability" });
    expect(output.reasons.length).toBeLessThanOrEqual(5);
    expect(output.reasons.every(row => Number.isFinite(row.delta))).toBe(true);
    expect(output.text).toContain("not empirical causal proof");
    expect(queryFuture({ query: "Why did this happen?", run: actual[1], attribution, metricId: "affordability" }).kind).toBe("why");
    expect(queryFuture({ query: "What changed between these futures?", run: actual[1], referenceRun: actual[0] }).text).toContain("numerical differences, not causal attribution");
    expect(queryFuture({ query: "Predict the election", run: actual[1] }).kind).toBe("unsupported");
  });
  test("causal graph emits keyboard-selectable registered nodes and escaped text", () => {
    const graph = causalGraphSvg(housingCausalRegistry, "construction_capacity");
    expect(graph).toContain('data-causal-node="construction_capacity"');
    expect(graph).toContain('role="button"');
    expect(graph).toContain("di-ripple");
    const hostile = { nodes: [{ id: "safe", label: '<img src=x onerror="boom">', kind: "input" }], edges: [] };
    expect(causalGraphSvg(hostile, "safe")).not.toContain("<img");
  });
});


describe("brief source provenance", () => {
  test("approved search prompt retains actual job/candidate provenance without invented IDs", () => {
    const optimizationSource = { optimizationJobId: "job-actual-42", candidateId: "candidate_2", stage: "finalist", sourceScenarioId: "plan", sourceExperimentId: "rules-source", modelVersion: experiment.modelVersion, seed: 42, objectives: [{ metricId: "affordability", direction: "maximize" }], screenRuns: 100, finalistRuns: 500 };
    const source = { ...experiment, metadata: { worldEditHistory: [{ id: "approved-search", model: "hbl-bounded-search.v1", provider: "user", prompt: `Optimization provenance: ${JSON.stringify(optimizationSource)}`, approvedAt: "2026-11-02T12:00:00.000Z", operations: [] }] } };
    const provenance = decisionIntelligenceProvenance({ experiment: source });
    expect(provenance.optimizations[0].optimizationSource.optimizationJobId).toBe("job-actual-42");
    expect(provenance.optimizations[0].optimizationSource.finalistRuns).toBe(500);
    const brief = renderDecisionBrief({ experiment: source, runs, model: housingModel });
    expect(brief).toContain("job-actual-42");
    expect(brief).toContain("Recorded search job / candidate sources");
    expect(decisionIntelligenceProvenance({ experiment }).optimizations).toEqual([]);
  });

  test("brief includes measured rules, verify priorities and exact robustness denominators, rejecting unrelated snapshots", () => {
    const report = { sourceFingerprint: fingerprintWorldInput(experiment), schemaVersion: "robustness-report.v1", status: "completed", modelVersion: experiment.modelVersion, seed: 42, years: 5, criterion: { metricId: "affordability", operator: "gte", value: 50 }, cells: [{ key: "plan:recession", success: 3, eligible: 10, failed: 1, missing: 0, experimentId: "stress-source" }], updatedAt: "2026-11-02T12:00:00.000Z" };
    const input = { experiment, runs, model: housingModel, robustnessReport: report };
    const rendered = renderDecisionBrief(input);
    expect(rendered).toContain("Failure → test a fix");
    expect(rendered).toContain("Assumptions to verify");
    expect(rendered).toContain("stress-source");
    expect(rendered).toContain("plan:recession");
    expect(buildDecisionManifest(input).intelligenceProvenance.robustness.cells[0].eligible).toBe(10);
    const mismatched = decisionIntelligenceProvenance({ experiment, robustnessReport: { ...report, sourceFingerprint: "different" } });
    expect(mismatched.robustness).toBeNull();
    expect(mismatched.robustnessNotice).toContain("different inputs");
  });
});
