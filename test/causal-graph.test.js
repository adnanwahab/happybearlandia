import { describe, expect, test } from "bun:test";
import { deriveCausalGraph, evaluateCausalGraph, traceCausalPathways } from "../world/causal-graph.js";

const variables = [
  "agency_capacity",
  "funding_delivery_rate",
  "local_compliance",
  "implementation_delay_months",
  "public_support",
  "political_turnover_probability",
  "polarization",
  "public_trust",
  "interest_rate",
  "inflation_rate",
  "credit_availability",
  "economic_growth",
  "population_growth",
  "migration_rate",
  "land_availability",
  "permitting_delay_months",
  "labor_availability",
  "infrastructure_capacity",
  "technology_improvement",
  "private_sector_response",
  "construction_cost_change",
  "community_cohesion",
  "climate_stress",
  "external_shock_probability",
  "major_disruption_probability",
].map((id) => ({ id }));

function world(overrides = {}) {
  return {
    normalized: {
      agency_capacity: 0.85,
      funding_delivery_rate: 0.85,
      local_compliance: 0.8,
      implementation_delay_months: 0.15,
      public_support: 0.75,
      political_turnover_probability: 0.2,
      polarization: 0.2,
      public_trust: 0.75,
      interest_rate: 0.2,
      inflation_rate: 0.25,
      credit_availability: 0.8,
      economic_growth: 0.75,
      population_growth: 0.55,
      migration_rate: 0.55,
      land_availability: 0.75,
      permitting_delay_months: 0.2,
      labor_availability: 0.8,
      infrastructure_capacity: 0.8,
      technology_improvement: 0.7,
      private_sector_response: 0.75,
      construction_cost_change: 0.2,
      community_cohesion: 0.75,
      climate_stress: 0.2,
      external_shock_probability: 0.1,
      major_disruption_probability: 0.08,
      ...overrides,
    },
  };
}

describe("causal graph", () => {
  test("derives explicit edges and named feedback loops", () => {
    const graph = deriveCausalGraph(variables);
    expect(graph.schemaVersion).toBe("hbl-causal-graph.v1");
    expect(graph.edges.length).toBeGreaterThan(20);
    expect(graph.feedbackLoops.map((loop) => loop.id)).toContain("implementation_trust_loop");
    expect(graph.feedbackLoops.map((loop) => loop.id)).toContain("supply_price_balancing_loop");
  });

  test("propagates favorable implementation conditions into stronger derived capacity", () => {
    const graph = deriveCausalGraph(variables);
    const strong = evaluateCausalGraph({ world: world(), edges: graph.edges });
    const weak = evaluateCausalGraph({
      world: world({
        agency_capacity: 0.15,
        funding_delivery_rate: 0.15,
        local_compliance: 0.2,
        implementation_delay_months: 0.9,
        public_support: 0.2,
        public_trust: 0.2,
      }),
      edges: graph.edges,
    });
    expect(strong.state.delivery_capacity).toBeGreaterThan(weak.state.delivery_capacity);
    expect(strong.state.public_confidence).toBeGreaterThan(weak.state.public_confidence);
    expect(strong.state.political_durability).toBeGreaterThan(weak.state.political_durability);
  });

  test("traces auditable causal pathways and keeps feedback bounded", () => {
    const graph = deriveCausalGraph(variables);
    const evaluated = evaluateCausalGraph({ world: world(), edges: graph.edges, iterations: 8 });
    const paths = traceCausalPathways(evaluated);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((path) => path.nodes.length >= 2)).toBe(true);
    for (const value of Object.values(evaluated.state)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
