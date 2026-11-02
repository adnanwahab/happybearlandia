import { describe, expect, test } from "bun:test";
import { compareRealities, explainReality } from "../world/reality-inspector.js";

const experiment = {
  worldModel: {
    variables: [
      { id: "a", label: "A", baseline: 5, range: { min: 0, max: 10 } },
      { id: "b", label: "B", baseline: 0.5, range: { min: 0, max: 1 } },
    ],
  },
};

const a = { worldId: "w1", score: 40, status: "negative", metrics: { outcome: 4 }, world: { conditions: { a: 0, b: 0.4 } } };
const b = { worldId: "w2", score: 80, status: "positive", metrics: { outcome: 8 }, world: { conditions: { a: 10, b: 0.45 } } };

describe("reality inspector", () => {
  test("ranks the largest deviations from the reviewed assumptions", () => {
    const explanation = explainReality(a, experiment);
    expect(explanation.topDrivers[0].id).toBe("a");
    expect(explanation.topDrivers[0].normalizedDeviation).toBe(-0.5);
  });

  test("compares two realities by normalized condition changes", () => {
    const comparison = compareRealities(a, b, experiment);
    expect(comparison.scoreDelta).toBe(40);
    expect(comparison.largestConditionChanges[0].id).toBe("a");
    expect(comparison.largestConditionChanges[0].normalizedDelta).toBe(1);
  });
});
