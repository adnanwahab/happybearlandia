import { describe, expect, test } from "bun:test";
import {
  filterSimulationBatchByScenarioFamily,
  scenarioTargetingAnalysis,
  summarizeScenarioFamilies,
} from "../world/scenario-outcome-analysis.js";

const experiment = {
  worldModel: {
    variables: [
      { id: "public_trust", label: "Public trust", category: "social", range: { min: 0, max: 1 } },
      { id: "political_turnover_probability", label: "Political turnover", category: "politics", range: { min: 0, max: 1 } },
    ],
  },
};

function simulation(id, family, score, trust, turnover, effect = -0.2) {
  return {
    id: `run_${id}`,
    worldId: id,
    score,
    status: score >= 70 ? "positive" : score >= 45 ? "mixed" : "negative",
    world: {
      scenarioFamily: { id: family, label: family === "baseline" ? "Baseline" : "Political reversal" },
      normalized: { public_trust: trust, political_turnover_probability: turnover },
      conditions: { public_trust: trust, political_turnover_probability: turnover },
    },
    metrics: { score },
    explanation: {
      causalPathways: [{ id: "politics_to_delivery", description: "politics → delivery", target: "delivery_capacity", effect }],
      feedbackLoops: [{ id: "implementation_trust", label: "Implementation ↔ trust", type: "reinforcing", activity: Math.abs(effect) }],
    },
  };
}

const batch = {
  simulations: [
    simulation("world_1", "baseline", 82, 0.75, 0.20, 0.18),
    simulation("world_2", "baseline", 76, 0.70, 0.25, 0.14),
    simulation("world_3", "political_reversal", 35, 0.30, 0.85, -0.42),
    simulation("world_4", "political_reversal", 42, 0.35, 0.80, -0.38),
  ],
};

describe("scenario-family outcome analysis", () => {
  test("identifies the weakest family and summarizes robustness", () => {
    const comparison = summarizeScenarioFamilies(batch, experiment);
    expect(comparison.schemaVersion).toBe("scenario-family-outcomes.v1");
    expect(comparison.familyCount).toBe(2);
    expect(comparison.weakestFamilyId).toBe("political_reversal");
    expect(comparison.weakestFamily.robustness).toBe(0);
    expect(comparison.strongestFamilyId).toBe("baseline");
    expect(comparison.strongestFamily.robustness).toBe(1);
  });

  test("reports conditions that distinguish the weak family from the rest", () => {
    const comparison = summarizeScenarioFamilies(batch, experiment);
    const drivers = comparison.weakestFamily.distinguishingConditions;
    expect(drivers.find((row) => row.id === "political_turnover_probability").delta).toBeGreaterThan(0);
    expect(drivers.find((row) => row.id === "public_trust").delta).toBeLessThan(0);
    expect(comparison.weakestFamily.causalPathways[0].id).toBe("politics_to_delivery");
  });

  test("creates scenario-targeted improvement signals", () => {
    const comparison = summarizeScenarioFamilies(batch, experiment);
    const targeted = scenarioTargetingAnalysis(comparison, "political_reversal");
    expect(targeted.scenarioFamilyId).toBe("political_reversal");
    expect(targeted.sensitivities.find((row) => row.id === "political_turnover_probability").direction).toBe("higher-associated-with-worse");
    expect(targeted.sensitivities.find((row) => row.id === "public_trust").direction).toBe("higher-associated-with-better");
  });

  test("filters a simulation batch without changing its adapter metadata", () => {
    const input = { adapter: { id: "hbl" }, simulations: batch.simulations };
    const filtered = filterSimulationBatchByScenarioFamily(input, "baseline");
    expect(filtered.adapter.id).toBe("hbl");
    expect(filtered.simulations).toHaveLength(2);
  });
});
