import { describe, expect, test } from "bun:test";
import { auditExperiment, buildExperimentBundle, shareExperimentViewModel } from "../world/experiment-audit.js";
import { GOLDEN_SCENARIOS, validateGoldenSimulation } from "../world/golden-scenarios.js";

const record = {
  experiment: {
    schemaVersion: "civic-experiment.v1",
    id: "e1",
    plan: { id: "p1", title: "Housing" },
    model: { simulator: { id: "hbl", version: "1" } },
    worldModel: { variables: [{ id: "agency_capacity", unit: "index", provenance: { type: "heuristic", confidence: 0.5 }, calibration: { status: "uncalibrated" } }], causalEdges: [] },
  },
  worldBatch: { seed: 42, runs: 1, worlds: [{ id: "w1" }] },
  simulationBatch: { adapter: { id: "hbl" }, simulations: [{ worldId: "w1", score: 60, status: "mixed", world: { conditions: { agency_capacity: 0.5 }, normalized: { agency_capacity: 0.5 } }, metrics: { score: 60 }, timeline: [{ year: 1, score: 60 }] }] },
  analyzedExperiment: { outcomes: { summary: { robustness: 0.5, expectedScore: 60 } } },
};

describe("experiment audit and bundle", () => {
  test("audits traceability without claiming predictive validity", () => {
    const audit = auditExperiment(record);
    expect(audit.ok).toBe(true);
    expect(audit.confidenceClass).toBe("exploratory");
    expect(audit.warnings.some((row) => row.includes("heuristic"))).toBe(true);
  });
  test("builds a portable bundle and share view", () => {
    const bundle = buildExperimentBundle(record);
    expect(bundle.schemaVersion).toBe("hbl-experiment-bundle.v1");
    expect(shareExperimentViewModel(record).title).toBe("Housing");
  });
  test("ships golden scenario validation fixtures", () => {
    expect(GOLDEN_SCENARIOS.length).toBeGreaterThanOrEqual(5);
    expect(validateGoldenSimulation(record.simulationBatch.simulations[0], GOLDEN_SCENARIOS[0]).ok).toBe(true);
  });
});
