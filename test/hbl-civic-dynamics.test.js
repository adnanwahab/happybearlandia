import { describe, expect, test } from "bun:test";
import { simulateHblCivicDynamics } from "../world/hbl-civic-dynamics.js";

const experiment = {
  id: "exp_housing",
  plan: {
    id: "plan_housing",
    title: "Housing supply and affordability",
    actions: [
      { id: "a1", title: "Streamline permitting" },
      { id: "a2", title: "Fund affordable construction" },
      { id: "a3", title: "Expand transit infrastructure" },
    ],
    goals: [{ id: "g1", title: "Lower housing cost burden" }],
    metrics: [],
  },
  experiment: { horizonYears: 10 },
  outcomes: {
    metricRegistry: [
      { id: "housing_units_permitted", domain: "housing", direction: "higher-is-better", unit: "count" },
      { id: "median_housing_cost", domain: "housing", direction: "lower-is-better", unit: "currency" },
      { id: "housing_cost_burden", domain: "housing", direction: "lower-is-better", unit: "fraction" },
      { id: "implementation_viability", domain: "implementation", direction: "higher-is-better", unit: "index" },
      { id: "delivery_reliability", domain: "implementation", direction: "higher-is-better", unit: "index" },
      { id: "political_durability", domain: "implementation", direction: "higher-is-better", unit: "index" },
      { id: "disruption_resilience", domain: "implementation", direction: "higher-is-better", unit: "index" },
    ],
  },
};

const goodWorld = {
  id: "world_good",
  conditions: {
    implementation_delay_months: 2,
    external_shock_probability: 0.01,
    major_disruption_probability: 0.005,
    political_turnover_probability: 0.02,
  },
  normalized: {
    agency_capacity: 0.95,
    funding_delivery_rate: 0.95,
    local_compliance: 0.90,
    enforcement_rate: 0.90,
    implementation_delay_months: 0.05,
    public_support: 0.90,
    external_shock_probability: 0.02,
    major_disruption_probability: 0.02,
    political_turnover_probability: 0.02,
    polarization: 0.10,
    public_trust: 0.90,
    labor_availability: 0.90,
    interest_rate: 0.15,
    inflation_rate: 0.20,
    credit_availability: 0.90,
    population_growth: 0.55,
    migration_rate: 0.55,
    household_size: 0.45,
    land_availability: 0.85,
    permitting_delay_months: 0.08,
    infrastructure_capacity: 0.90,
    technology_improvement: 0.80,
    private_sector_response: 0.85,
    construction_cost_change: 0.15,
    community_cohesion: 0.80,
    inequality: 0.25,
    climate_stress: 0.20,
    economic_growth: 0.75,
    unemployment_rate: 0.15,
  },
};

const badWorld = {
  id: "world_bad",
  conditions: {
    implementation_delay_months: 24,
    external_shock_probability: 0.30,
    major_disruption_probability: 0.15,
    political_turnover_probability: 0.35,
  },
  normalized: {
    agency_capacity: 0.15,
    funding_delivery_rate: 0.20,
    local_compliance: 0.15,
    enforcement_rate: 0.20,
    implementation_delay_months: 0.90,
    public_support: 0.20,
    external_shock_probability: 0.95,
    major_disruption_probability: 0.95,
    political_turnover_probability: 0.95,
    polarization: 0.90,
    public_trust: 0.15,
    labor_availability: 0.20,
    interest_rate: 0.90,
    inflation_rate: 0.85,
    credit_availability: 0.15,
    population_growth: 0.75,
    migration_rate: 0.80,
    household_size: 0.75,
    land_availability: 0.15,
    permitting_delay_months: 0.95,
    infrastructure_capacity: 0.20,
    technology_improvement: 0.20,
    private_sector_response: 0.20,
    construction_cost_change: 0.90,
    community_cohesion: 0.20,
    inequality: 0.85,
    climate_stress: 0.85,
    economic_growth: 0.15,
    unemployment_rate: 0.90,
  },
};

experiment.worldModel = {
  variables: [...new Set([...Object.keys(goodWorld.normalized), ...Object.keys(badWorld.normalized)])].map((id) => ({ id })),
  causalEdges: [],
};

describe("HBL civic dynamics", () => {
  test("returns deterministic yearly domain metrics and causal events", () => {
    const a = simulateHblCivicDynamics({ experiment, world: goodWorld });
    const b = simulateHblCivicDynamics({ experiment, world: goodWorld });
    expect(a).toEqual(b);
    expect(a.timeline).toHaveLength(10);
    expect(a.timeline.every((row) => Number.isFinite(row.score))).toBe(true);
    expect(Number.isFinite(a.metrics.housing_units_permitted)).toBe(true);
    expect(Number.isFinite(a.metrics.median_housing_cost)).toBe(true);
    expect(Array.isArray(a.events)).toBe(true);
    expect(a.model.id).toBe("hbl-civic-dynamics.v2");
    expect(a.model.predictive).toBe(false);
    expect(a.model.causalGraph).toBe("hbl-causal-graph.v1");
    expect(a.explanation.causalPathways.length).toBeGreaterThan(0);
    expect(a.explanation.feedbackLoops.length).toBeGreaterThan(0);
    expect(a.timeline[0].causalState).toBeTruthy();
  });

  test("strong implementation worlds outperform severe-friction worlds", () => {
    const good = simulateHblCivicDynamics({ experiment, world: goodWorld });
    const bad = simulateHblCivicDynamics({ experiment, world: badWorld });
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.metrics.housing_units_permitted).toBeGreaterThan(bad.metrics.housing_units_permitted);
    expect(good.metrics.median_housing_cost).toBeLessThan(bad.metrics.median_housing_cost);
    expect(bad.events.length).toBeGreaterThan(0);
  });
});
