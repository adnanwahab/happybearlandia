import { describe, expect, test } from "bun:test";
import { analyzeSensitivity, computeFailureModes, computeSensitivities } from "../world/sensitivity-analysis.js";

const simulations = Array.from({ length: 20 }, (_value, index) => {
  const a = index / 19;
  const b = (index % 5) / 4;
  const score = a * 100;
  return {
    worldId: `w${index}`,
    score,
    status: score >= 70 ? "positive" : score < 45 ? "negative" : "mixed",
    world: { conditions: { a, b }, normalized: { a, b } },
  };
});
const experiment = { worldModel: { variables: [
  { id: "a", label: "Strong driver", category: "test", range: { min: 0, max: 1 } },
  { id: "b", label: "Weak driver", category: "test", range: { min: 0, max: 1 } },
] } };

describe("sensitivity analysis", () => {
  test("ranks variables by correlation with the selected outcome", () => {
    const rows = computeSensitivities(simulations, experiment);
    expect(rows[0].id).toBe("a");
    expect(rows[0].correlation).toBeGreaterThan(0.99);
  });

  test("finds variables that separate failed and successful worlds", () => {
    const rows = computeFailureModes(simulations, experiment);
    expect(rows[0].id).toBe("a");
    expect(rows[0].pattern).toBe("lower-in-failures");
  });

  test("returns sensitivity and failure-mode views together", () => {
    const analysis = analyzeSensitivity(simulations, experiment);
    expect(analysis.sensitivities.length).toBeGreaterThan(0);
    expect(analysis.failureModes.length).toBeGreaterThan(0);
  });
});
