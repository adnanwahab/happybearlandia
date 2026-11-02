import { describe, expect, test } from "bun:test";
import { buildCivicExperiment } from "../world/civic-experiment.js";
import { deriveMetricRegistry, detectMetricDomains } from "../world/metric-registry.js";

const housingPlan = {
  title: "Housing affordability",
  actions: [{ title: "Permit more apartments near transit" }],
  metrics: ["median_new_home_price"],
};

describe("domain metric registry", () => {
  test("preserves explicit metrics and adds relevant domain metrics", () => {
    const metrics = deriveMetricRegistry(housingPlan);
    expect(metrics.map((metric) => metric.id)).toContain("median_new_home_price");
    expect(metrics.map((metric) => metric.id)).toContain("housing_units_permitted");
    expect(metrics.map((metric) => metric.id)).toContain("transit_access");
    expect(metrics.find((metric) => metric.id === "median_new_home_price").direction).toBe("lower-is-better");
  });

  test("detects plan domains from the manifest rather than a fixed simulation type", () => {
    expect(detectMetricDomains(housingPlan).map((row) => row.domain)).toEqual(expect.arrayContaining(["housing", "transit"]));
  });

  test("attaches a registry to CivicExperiment without replacing Dear Congress metrics", () => {
    const synthesis = { packages: [{ title: "Housing", metrics: ["median_rent"], items: [{ proposal: { title: "Rezone apartments" } }] }] };
    const experiment = buildCivicExperiment(synthesis, { runs: 2, years: 1 });
    expect(experiment.outcomes.metrics).toEqual(["median_rent"]);
    expect(experiment.outcomes.metricRegistry.length).toBeGreaterThan(experiment.outcomes.metrics.length);
  });
});
