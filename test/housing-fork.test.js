import { describe, expect, test } from "bun:test";
import { simulateHousingRun, simulateHousingFork, resolveHousingModel, createHousingScenarios, runHousingCounterfactual, explainHousingRun, housingCausalRegistry } from "../world/models/housing/index.js";
import { createBuildingProposal } from "../world/buildings/proposal.js";
import { simulateHousingRun as frozenV11 } from "../world/models/housing/legacy-v1.1.js";

const tower = (id = "test-tower", x = 142) => createBuildingProposal({ id, status: "approved", location: { x } });
const input = () => ({ parameters: createHousingScenarios()[1].parameters, seed: 42, years: 10, projects: [tower()] });
const fork = (month, operations = [], base = input()) => simulateHousingFork({ ...base, fork: { month, operations } });
describe("true monthly housing forks", () => {
  test("no-op forks reproduce complete original numerical/history output", () => {
    const base = input();
    const original = simulateHousingRun(base);
    for (const month of [0, 5, 24, 37, 120]) {
      const branch = fork(month, [], base);
      const { fork: lineage, ...body } = branch;
      expect(body).toEqual(original);
      expect(lineage.appliedAtMonth).toBe(month + 1);
    }
  });
  test("parameter changes retain every prefix and existing projects' exact progress and risk draws", () => {
    const base = input();
    const original = simulateHousingRun(base);
    const branch = fork(24, [{ op: "set_parameter", target: "construction_capacity", value: 1000 }], base);
    expect(branch.monthlyTimeline.filter((row) => row.month <= 24)).toEqual(original.monthlyTimeline.filter((row) => row.month <= 24));
    expect(branch.events.filter((row) => row.month <= 24)).toEqual(original.events.filter((row) => row.month <= 24));
    expect(branch.projects[0].states.filter((row) => row.month <= 24)).toEqual(original.projects[0].states.filter((row) => row.month <= 24));
    expect(branch.projects[0].uncertainty).toEqual(original.projects[0].uncertainty);
    expect(branch.metrics).not.toEqual(original.metrics);
    expect(branch).toEqual(fork(24, [{ op: "set_parameter", target: "construction_capacity", value: 1000 }], base));
  });
  test("adding a project after the branch reserves capacity and pays only forward costs", () => {
    const base = input();
    const original = simulateHousingRun(base);
    const added = tower("branch-tower", -142);
    const branch = fork(24, [{ op: "add_building", target: "world.projects", value: added }], base);
    expect(branch.monthlyTimeline.slice(0, 25)).toEqual(original.monthlyTimeline.slice(0, 25));
    const project = branch.projects.find((row) => row.projectId === added.id);
    expect(project.states[0].month).toBe(25);
    expect(project.events.find((event) => event.type === "PROJECT_APPROVED").month).toBe(25);
    expect(project.states.at(-1).completedUnits).toBe(310);
    expect(branch.projectMetrics.completedUnits).toBe(620);
    expect(branch.projects.find((row) => row.projectId === "test-tower").states.slice(0, 25)).toEqual(original.projects[0].states.slice(0, 25));
    for (const row of branch.accounting.capacityLedger) expect(row.project + row.systemic).toBeLessThanOrEqual(row.total + 1e-8);
    const a = branch.accounting;
    expect(a.finalHousing).toBeCloseTo(a.initialHousing + a.completedHomes - a.demolishedHomes, 5);
    expect(a.initialPipelineHomes + a.starts).toBeCloseTo(a.systemicCompletedHomes + a.pipelineHomes, 5);
    expect(branch.metrics.public_expenditure).toBeCloseTo(a.subsidySpent + a.voucherSpent + a.projectPublicSpent, 5);
  });
  test("cancelling in-progress work preserves sunk cost and does not erase history", () => {
    const base = input();
    const original = simulateHousingRun(base);
    const branch = fork(24, [{ op: "remove_building", target: "test-tower" }], base);
    const stateAtBranch = original.projects[0].states[24];
    expect(stateAtBranch.publicCost).toBeGreaterThan(0);
    expect(branch.projects[0].states.slice(0, 25)).toEqual(original.projects[0].states.slice(0, 25));
    expect(branch.projects[0].states[25].status).toBe("cancelled");
    expect(branch.projects[0].states.at(-1).publicCost).toBe(stateAtBranch.publicCost);
    expect(branch.projectMetrics.completedUnits).toBe(0);
  });
  test("fork stress starts after branch and leaves scheduled stress once in place", () => {
    const base = { ...input(), scheduledStress: [{ presetId: "budget-cut", startMonth: 12 }] };
    const original = simulateHousingRun(base);
    const branch = fork(36, [{ op: "apply_stress_preset", target: "stressPresets", value: "recession" }], base);
    expect(branch.monthlyTimeline.slice(0, 37)).toEqual(original.monthlyTimeline.slice(0, 37));
    expect(branch.events.filter((row) => row.type === "STRESS_PRESET_STARTED").length).toBe(1);
    expect(branch.events.find((row) => row.type === "TIMELINE_FORK_APPLIED").month).toBe(37);
    expect(branch.metrics.affordability).not.toBe(original.metrics.affordability);
  });
  test("rejects state rewrites, geometry history changes, unapproved additions and completed-stock deletion", () => {
    for (const operation of [
      { op: "set_parameter", target: "initial_housing", value: 2000000 },
      { op: "change_equation", target: "median_rent", value: "evil()" },
      { op: "move_building", target: "test-tower", value: { x: 1000 } },
      { op: "update_building", target: "test-tower", value: { geometry: { floors: 30 } } },
      { op: "add_building", target: "world.projects", value: createBuildingProposal({ id: "unapproved" }) },
    ]) expect(() => fork(24, [operation])).toThrow();
    expect(() => fork(100, [{ op: "remove_building", target: "test-tower" }])).toThrow("completed");
    expect(() => fork(-1)).toThrow();
  });
  test("retained1.1 is unchanged; latest no-op preserves old metric and project prefix", () => {
    const base = input();
    const old = frozenV11(base);
    expect(resolveHousingModel("1.1.0").simulateRun(base)).toEqual(old);
    expect(resolveHousingModel("1.1.0").model.supportsFork).toBeUndefined();
    expect(() => resolveHousingModel("1.1.0").simulateRun({ ...base, fork: { month: 24, operations: [] } })).toThrow();
    const latest = simulateHousingRun(base);
    expect(latest.metrics).toEqual(old.metrics);
    expect(latest.timeline).toEqual(old.timeline);
    expect(latest.projects[0].states).toEqual(old.projects[0].states);
  });
});

describe("equation-backed numerical explanations", () => {
  const recorded = () => { const base = input(); return { ...simulateHousingRun(base), sampledParameters: base.parameters, inputProjects: base.projects, seed: base.seed }; };
  test("OAT uses actual paired reruns with retained inputs, seed and version", () => {
    const run = recorded();
    const result = runHousingCounterfactual({ run, parameterId: "interest_rate", value: 0.1, metricId: "median_rent" });
    expect(result.baseline.metrics).toEqual(run.metrics);
    expect(result.delta).toBe(result.counterfactual.metrics.median_rent - run.metrics.median_rent);
    expect(result.recordedMismatch).toEqual([]);
    expect(result.counterfactual.projects[0].proposal).toEqual(run.inputProjects[0]);
    expect(result.seed).toBe(42);
    expect(result.modelVersion).toBe("1.2.0");
  });
  test("old recorded versions are resolved rather than reinterpreted", () => {
    const base = input();
    const old = { ...frozenV11(base), sampledParameters: base.parameters, inputProjects: base.projects, seed: 42 };
    const result = runHousingCounterfactual({ run: old, parameterId: "interest_rate", value: 0.1 });
    expect(result.baseline).toEqual(frozenV11(base));
    expect(result.modelVersion).toBe("1.1.0");
  });
  test("top five and residual are numerical and explicitly nonadditive", () => {
    const result = explainHousingRun({ run: recorded(), metricId: "median_rent" });
    expect(result.topFive.length).toBeLessThanOrEqual(5);
    expect(result.contributions.length).toBeGreaterThan(0);
    expect(result.residual + result.sumOfReversions).toBeCloseTo(result.totalDelta, 8);
    expect(result.caveat).toContain("not causal percentages");
    expect(result.empirical).toBe(false);
    for (const row of result.contributions) expect(row.delta).toBe(result.selected.metrics.median_rent - row.counterfactualMetric);
    for (const edge of housingCausalRegistry.edges) expect(housingCausalRegistry.equations.some((equation) => equation.id === edge.equationId)).toBe(true);
  });
});
