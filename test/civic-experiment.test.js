import { describe, expect, test } from "bun:test";
import { buildCivicExperiment, buildPlanManifest } from "../world/civic-experiment.js";

const NOW = new Date("2026-11-02T12:00:00.000Z");

const synthesis = {
  packages: [
    {
      id: "pkg_housing",
      title: "Affordable Housing Plan",
      summary: "Build more homes and reduce permitting delay.",
      assumptions: ["Local governments participate"],
      items: [
        {
          score: 0.84,
          proposal: {
            id: "zoning",
            title: "Allow more homes near transit",
            description: "Legalize denser housing around frequent transit.",
            needId: "housing_cost"
          }
        },
        {
          proposal: {
            id: "permits",
            title: "Speed up permitting",
            needId: "housing_cost"
          }
        }
      ]
    }
  ]
};

describe("plan manifest", () => {
  test("normalizes a Dear Congress package into a stable contract", () => {
    const manifest = buildPlanManifest(synthesis, {}, NOW);
    expect(manifest.schemaVersion).toBe("plan-manifest.v1");
    expect(manifest.id).toMatch(/^plan_/);
    expect(manifest.title).toBe("Affordable Housing Plan");
    expect(manifest.actions).toHaveLength(2);
    expect(manifest.actions[0].id).toBe("zoning");
    expect(manifest.goals[0].id).toBe("housing_cost");
  });

  test("produces deterministic ids independent of generatedAt", () => {
    const a = buildPlanManifest(synthesis, {}, new Date("2026-01-01T00:00:00Z"));
    const b = buildPlanManifest(synthesis, {}, new Date("2026-12-01T00:00:00Z"));
    expect(a.id).toBe(b.id);
  });
});

describe("civic experiment", () => {
  test("wraps the manifest for HBL and Pensieve", () => {
    const experiment = buildCivicExperiment(synthesis, { runs: 1000, years: 20, seed: 42 }, NOW);
    expect(experiment.schemaVersion).toBe("civic-experiment.v1");
    expect(experiment.plan.title).toBe("Affordable Housing Plan");
    expect(experiment.experiment).toEqual({ runs: 1000, horizonYears: 20, seed: 42 });
    expect(experiment.worldModel.variables.length).toBeGreaterThanOrEqual(7);
    expect(experiment.worldModel.parameterExtraction.defaultsAreEmpirical).toBe(false);
    expect(experiment.worldModel.causalEdges.length).toBeGreaterThan(0);
    expect(experiment.worldModel.feedbackLoops.length).toBeGreaterThan(0);
    expect(experiment.worldModel.causalGraph.schemaVersion).toBe("hbl-causal-graph.v1");
  });
});
