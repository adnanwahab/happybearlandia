import { describe, expect, test } from "bun:test";
import { createAgentPopulation, simulateAgentCivicDynamics } from "../world/agent-simulator.js";
import { createAgentCivicAdapter, simulateExperiment } from "../world/simulation-adapter.js";

const world = { id: "w1", seed: 42, normalized: { agency_capacity: 0.8, local_compliance: 0.7, funding_delivery_rate: 0.8, credit_availability: 0.7, interest_rate: 0.2, permitting_delay_months: 0.2, construction_cost_change: 0.3, public_support: 0.6 } };
const experiment = { id: "e1", experiment: { horizonYears: 5 }, plan: { id: "p1" } };

describe("optional agent simulator", () => {
  test("creates a deterministic synthetic population", () => {
    expect(createAgentPopulation(world, { households: 20 })).toEqual(createAgentPopulation(world, { households: 20 }));
  });
  test("returns the standard HBL simulation contract", () => {
    const result = simulateAgentCivicDynamics({ experiment, world, options: { agentPopulation: { households: 20, developers: 3 } } });
    expect(result.timeline).toHaveLength(5);
    expect(result.model.id).toBe("hbl-agent-civic.v1");
    expect(result.metrics.households_supported).toBeGreaterThanOrEqual(0);
  });
  test("can be selected as a normal simulation adapter", async () => {
    const batch = await simulateExperiment(experiment, { worlds: [world] }, createAgentCivicAdapter({ agentPopulation: { households: 20 } }));
    expect(batch.simulations[0].model.id).toBe("hbl-agent-civic.v1");
  });
});
