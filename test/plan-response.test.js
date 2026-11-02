import { describe, expect, test } from "bun:test";
import { buildPlanApiPayload } from "../world/plan-response.js";

const NOW = new Date("2026-11-02T12:00:00.000Z");

const candidateA = {
  id: "candidate_a",
  title: "Housing affordability plan",
  items: [
    {
      proposal: {
        id: "permit_more_homes",
        title: "Permit more homes",
        needId: "housing_affordability",
        metrics: ["housing_units_permitted"],
      },
    },
  ],
};

const candidateB = {
  id: "candidate_b",
  title: "Transit-oriented housing plan",
  items: [
    {
      proposal: {
        id: "transit_housing",
        title: "Build housing near transit",
        needId: "housing_affordability",
      },
    },
  ],
};

describe("HBL /api/plan response envelope", () => {
  test("wraps an upstream array in an object with a top-level civicExperiment", () => {
    const synthesis = [candidateA, candidateB];
    const payload = buildPlanApiPayload(synthesis, { runs: 1000, years: 10, seed: 42 }, NOW);

    expect(Array.isArray(payload)).toBe(false);
    expect(payload.responseSchemaVersion).toBe("hbl-plan-response.v1");
    expect(payload.synthesis).toBe(synthesis);
    expect(payload.civicExperiment.schemaVersion).toBe("civic-experiment.v1");
    expect(payload.civicExperiment.plan.title).toBe("Housing affordability plan");
    expect(payload.hblPlanResponse).toEqual({
      schemaVersion: "hbl-plan-response.v1",
      upstreamShape: "array",
      candidateCount: 2,
      selectedCandidateIndex: 0,
    });
  });

  test("preserves legacy top-level synthesis fields for object responses", () => {
    const synthesis = {
      title: "One plan",
      items: candidateA.items,
    };
    const payload = buildPlanApiPayload(synthesis, { runs: 10, years: 3 }, NOW);

    expect(payload.title).toBe("One plan");
    expect(payload.synthesis).toBe(synthesis);
    expect(payload.civicExperiment.schemaVersion).toBe("civic-experiment.v1");
    expect(payload.hblPlanResponse.upstreamShape).toBe("object");
    expect(payload.hblPlanResponse.candidateCount).toBe(1);
  });
});
