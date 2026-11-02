import { describe, expect, test } from "bun:test";
import { deriveScenarioFamilies, selectScenarioFamily } from "../world/scenario-families.js";

const variables = [
  { id: "economic_growth" },
  { id: "unemployment_rate" },
  { id: "credit_availability" },
  { id: "technology_improvement" },
  { id: "public_trust" },
];

describe("scenario families", () => {
  test("derives normalized families and filters shifts to available variables", () => {
    const families = deriveScenarioFamilies(variables);
    expect(families.length).toBeGreaterThanOrEqual(6);
    const total = families.reduce((sum, family) => sum + family.weight, 0);
    expect(total).toBeCloseTo(1, 8);
    const boom = families.find((family) => family.id === "boom");
    expect(boom.shifts.economic_growth).toBeGreaterThan(0);
    expect(boom.shifts.migration_rate).toBeUndefined();
  });

  test("selects families deterministically from the same unit draw", () => {
    const families = deriveScenarioFamilies(variables);
    expect(selectScenarioFamily(families, 0.42)).toEqual(selectScenarioFamily(families, 0.42));
  });
});
