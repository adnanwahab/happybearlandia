import { describe, expect, test } from "bun:test";
import { extractSimulationParameters, summarizeParameterExtraction } from "../world/parameter-extractor.js";

describe("automatic simulation parameter extraction", () => {
  test("always includes implementation quality and shock variables", () => {
    const variables = extractSimulationParameters({ title: "A civic plan", actions: [] });
    const ids = new Set(variables.map((variable) => variable.id));
    expect(ids.has("agency_capacity")).toBe(true);
    expect(ids.has("funding_delivery_rate")).toBe(true);
    expect(ids.has("local_compliance")).toBe(true);
    expect(ids.has("implementation_delay_months")).toBe(true);
    expect(ids.has("external_shock_probability")).toBe(true);
  });

  test("adds housing, finance, construction, migration, and permitting variables when relevant", () => {
    const variables = extractSimulationParameters({
      title: "Affordable Housing Plan",
      summary: "Reform zoning and permitting, finance construction, and build homes near transit as population grows.",
      actions: [{ title: "Speed up permits for housing developers" }]
    });
    const ids = new Set(variables.map((variable) => variable.id));
    for (const id of ["interest_rate", "population_growth", "migration_rate", "construction_cost_change", "permitting_delay_months", "land_availability", "private_sector_response"]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test("applies editable overrides without hiding that they are user supplied", () => {
    const variables = extractSimulationParameters(
      { title: "Affordable Housing Plan" },
      { interest_rate: { baseline: 0.08, min: 0.03, max: 0.10, locked: true } }
    );
    const interest = variables.find((variable) => variable.id === "interest_rate");
    expect(interest.baseline).toBe(0.08);
    expect(interest.range).toEqual({ min: 0.03, max: 0.10 });
    expect(interest.locked).toBe(true);
    expect(interest.source).toBe("user-override");
  });

  test("marks heuristic defaults as non-empirical", () => {
    const variables = extractSimulationParameters({ title: "Housing and transit plan" });
    const summary = summarizeParameterExtraction(variables);
    expect(summary.defaultsAreEmpirical).toBe(false);
    expect(summary.variableCount).toBeGreaterThan(7);
  });
});
