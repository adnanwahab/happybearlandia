import { describe, expect, test } from "bun:test";
import { createImplementationStressAdapter, simulateExperiment } from "../world/simulation-adapter.js";
import {
  applyPlanImprovement,
  applySimulationEffectsToWorld,
  generatePlanImprovements,
} from "../world/plan-improver.js";

const experiment = {
  id: "exp_original",
  plan: { id: "plan_1", title: "Plan", actions: [] },
  lineage: { revision: 1 },
  worldModel: { variables: [
    { id: "agency_capacity", label: "Agency capacity", baseline: 0.7, range: { min: 0.3, max: 1 } },
  ] },
};
const sensitivity = {
  sensitivities: [{ id: "agency_capacity", label: "Agency capacity", correlation: 0.9, absoluteCorrelation: 0.9, direction: "higher-associated-with-better" }],
  failureModes: [{ id: "agency_capacity", pattern: "lower-in-failures", delta: -0.5 }],
};

describe("plan improver", () => {
  test("turns sensitivity into an explicit testable plan hypothesis", () => {
    const [improvement] = generatePlanImprovements(experiment, sensitivity);
    expect(improvement.targetVariableId).toBe("agency_capacity");
    expect(improvement.simulationEffect.direction).toBe("increase");
    expect(improvement.warning).toContain("not evidence");
  });

  test("creates a new experiment revision without replacing the parent", () => {
    const improvement = generatePlanImprovements(experiment, sensitivity)[0];
    const revised = applyPlanImprovement(experiment, improvement);
    expect(revised.lineage.parentExperimentId).toBe("exp_original");
    expect(revised.lineage.revision).toBe(2);
    expect(revised.plan.actions).toHaveLength(1);
    expect(experiment.plan.actions).toHaveLength(0);
  });

  test("applies modeled plan resilience to the same source world", () => {
    const improvement = generatePlanImprovements(experiment, sensitivity)[0];
    const revised = applyPlanImprovement(experiment, improvement);
    const source = { id: "w1", conditions: { agency_capacity: 0.4 }, normalized: { agency_capacity: 0.143 }, deviations: {} };
    const effective = applySimulationEffectsToWorld(revised, source);
    expect(effective.conditions.agency_capacity).toBeGreaterThan(0.4);
    expect(effective.sourceConditions.agency_capacity).toBe(0.4);
  });

  test("can re-run exactly the same worlds under the revised plan", async () => {
    const improvement = generatePlanImprovements(experiment, sensitivity)[0];
    const revised = applyPlanImprovement(experiment, improvement);
    const batch = { worlds: [{ id: "w1", conditions: { agency_capacity: 0.3 }, normalized: { agency_capacity: 0 }, deviations: {} }] };
    const adapter = createImplementationStressAdapter();
    const before = await simulateExperiment(experiment, batch, adapter);
    const after = await simulateExperiment(revised, batch, adapter);
    expect(after.simulations[0].score).toBeGreaterThan(before.simulations[0].score);
    expect(after.simulations[0].world.conditions.agency_capacity).toBe(0.3);
    expect(after.simulations[0].effectiveWorld.conditions.agency_capacity).toBeGreaterThan(0.3);
  });
});
