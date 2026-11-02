import { describe, expect, test } from "bun:test";
import { buildCivicExperiment } from "../world/civic-experiment.js";
import { runExperimentVerification } from "../world/experiment-verification.js";

const synthesis = {
  packages: [{
    id: "pkg_1",
    title: "Housing resilience",
    items: [{ proposal: { title: "Streamline housing permits and fund local implementation" } }],
  }],
};

describe("experiment verification harness", () => {
  test("checks deterministic sampling and finite stress outputs", async () => {
    const experiment = buildCivicExperiment(synthesis, { runs: 12, years: 10, seed: 42 });
    const report = await runExperimentVerification(experiment, { runs: 12 });
    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.ok)).toBe(true);
    expect(report.checks.map((check) => check.id)).toContain("determinism");
    expect(report.checks.map((check) => check.id)).toContain("simulation-finite");
  });
});
