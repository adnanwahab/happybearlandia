import { describe, expect, test } from "bun:test";
import {
  isCivicExperiment,
  resolveCivicExperimentPayload,
  validateCivicExperiment,
} from "../world/experiment-contract.js";

const synthesis = {
  packages: [{
    id: "pkg_housing",
    title: "Housing plan",
    items: [{ proposal: { id: "p1", title: "Permit more homes", metrics: ["housing_units_permitted"] } }],
  }],
};

describe("civic experiment contract bridge", () => {
  test("uses the server envelope when civicExperiment is present", () => {
    const direct = resolveCivicExperimentPayload(synthesis, { runs: 3, years: 2, seed: 7 }).experiment;
    const resolved = resolveCivicExperimentPayload({ civicExperiment: direct });
    expect(resolved.source).toBe("server-envelope");
    expect(resolved.warning).toBe(null);
    expect(resolved.experiment).toBe(direct);
  });

  test("normalizes a raw Dear Congress response instead of blocking the lab", () => {
    const resolved = resolveCivicExperimentPayload(synthesis, { runs: 12, years: 8, seed: 42 });
    expect(resolved.source).toBe("browser-normalized");
    expect(resolved.warning).toContain("server response did not include");
    expect(isCivicExperiment(resolved.experiment)).toBe(true);
    expect(resolved.experiment.experiment.runs).toBe(12);
    expect(resolved.experiment.worldModel.variables.length).toBeGreaterThan(0);
  });

  test("normalizes a raw Dear Congress candidate array", () => {
    const arraySynthesis = synthesis.packages.map((pkg) => ({ ...pkg }));
    const resolved = resolveCivicExperimentPayload(arraySynthesis, { runs: 5, years: 4, seed: 9 });
    expect(resolved.source).toBe("browser-normalized");
    expect(isCivicExperiment(resolved.experiment)).toBe(true);
    expect(resolved.experiment.plan.title).toBe("Housing plan");
    expect(resolved.experiment.experiment).toEqual({ runs: 5, horizonYears: 4, seed: 9 });
  });

  test("validates the minimum v1 experiment contract", () => {
    const experiment = resolveCivicExperimentPayload(synthesis, { runs: 2, years: 1 }).experiment;
    expect(validateCivicExperiment(experiment)).toMatchObject({ ok: true });
  });
});
