import { describe, expect, test } from "bun:test";
import {
  createImplementationStressAdapter,
  createSimulationAdapter,
  simulateExperiment,
} from "../world/simulation-adapter.js";

const experiment = { id: "exp_1", plan: { id: "plan_1" } };
const worldBatch = {
  worlds: [
    { id: "world_1", normalized: { agency_capacity: 1, funding_delivery_rate: 1, local_compliance: 1, enforcement_rate: 1, implementation_delay_months: 0, public_support: 1, external_shock_probability: 0 } },
    { id: "world_2", normalized: { agency_capacity: 0, funding_delivery_rate: 0, local_compliance: 0, enforcement_rate: 0, implementation_delay_months: 1, public_support: 0, external_shock_probability: 1 } },
  ],
};

describe("simulation adapter", () => {
  test("generic stress adapter clearly marks itself non-predictive", async () => {
    const batch = await simulateExperiment(experiment, worldBatch, createImplementationStressAdapter());
    expect(batch.adapter.predictive).toBe(false);
    expect(batch.simulations[0].score).toBeGreaterThan(batch.simulations[1].score);
    expect(batch.simulations[0].disclaimer).toContain("stress score");
  });

  test("supports pluggable HBL/domain adapters", async () => {
    const adapter = createSimulationAdapter({
      id: "demo-domain",
      predictive: true,
      simulateWorld: ({ world }) => ({ score: world.id === "world_1" ? 80 : 20, metrics: { outcome: 123 } }),
    });
    const batch = await simulateExperiment(experiment, worldBatch, adapter, { concurrency: 2 });
    expect(batch.simulations.map((row) => row.score)).toEqual([80, 20]);
    expect(batch.adapter.predictive).toBe(true);
  });
});
