import { describe, expect, test } from "bun:test";
import { runLiveSimulation, normalizeLiveOverrides, normalizeLiveTimeline } from "../world/live-simulation.js";

const experiment = {
  id: "live-test",
  plan: { id: "housing", actions: [{ title: "Build housing" }], goals: [] },
  worldModel: { variables: [
    { id: "agency_capacity", range: { min: 0, max: 1 }, baseline: 0.5 },
    { id: "implementation_delay_months", range: { min: 0, max: 36 }, baseline: 6 },
    { id: "external_shock_probability", range: { min: 0, max: 1 }, baseline: 0.1 },
  ] },
  outcomes: { metricRegistry: [{ id: "housing_units_permitted", domain: "housing", unit: "count", direction: "higher-is-better" }] },
};

describe("live simulation", () => {
  test("is deterministic and baseline/current are identical without overrides", async () => {
    const options = { experiment, runs: 3, years: 4, seed: 51 };
    const a = await runLiveSimulation(options);
    expect(a).toEqual(await runLiveSimulation(options));
    expect(a.baseline).toEqual(a.current);
    expect(a.current.timeline).toHaveLength(4);
    expect(a.current.timeline.every((row) => Number.isFinite(row.metrics.housing_units_permitted) && row.sampleCount === 3)).toBe(true);
  });

  test("native numeric controls reach effective worlds and change yearly outcomes with paired seeds", async () => {
    const before = JSON.stringify(experiment);
    const low = await runLiveSimulation({ experiment, runs: 3, overrides: { agency_capacity: 0, implementation_delay_months: 36 } });
    const high = await runLiveSimulation({ experiment, runs: 3, overrides: { agency_capacity: 1, implementation_delay_months: 0 } });
    expect(low.baseline).toEqual(high.baseline);
    expect(high.current.score).toBeGreaterThan(low.current.score);
    for (let index = 0; index < 3; index++) {
      const a = high.baseline.simulations[index];
      const b = high.current.simulations[index];
      expect(a.world.seed).toBe(b.world.seed);
      expect(a.world.id).toBe(b.world.id);
      expect(a.world.conditions.external_shock_probability).toBe(b.world.conditions.external_shock_probability);
      expect(b.effectiveWorld.conditions.agency_capacity).toBe(1);
      expect(b.effectiveWorld.normalized.agency_capacity).toBe(1);
      expect(b.effectiveWorld.conditions.implementation_delay_months).toBe(0);
    }
    expect(JSON.stringify(experiment)).toBe(before);
  });

  test("clamps controls and rejects invalid/unknown controls clearly", () => {
    const result = normalizeLiveOverrides(experiment, { agency_capacity: 50, implementation_delay_months: { baseline: -2 }, external_shock_probability: NaN, missing: 1 });
    expect(result.values).toEqual({ agency_capacity: 1, implementation_delay_months: 0 });
    expect(result.warnings).toHaveLength(4);
    expect(normalizeLiveOverrides(experiment, { agency_capacity: null }).values).toEqual({});
  });

  test("bounds workload and reports missing experiments", async () => {
    await expect(runLiveSimulation()).rejects.toThrow("world model variables");
    const result = await runLiveSimulation({ experiment, years: 200, runs: 0, seed: Infinity });
    expect(result.years).toBe(50);
    expect(result.runs).toBe(1);
    expect(result.seed).toBe(42);
  });

  test("aggregates finite actual values and handles missing timeline data", () => {
    expect(normalizeLiveTimeline()).toEqual([]);
    const rows = normalizeLiveTimeline([{ timeline: [{ year: 1, score: 20, metrics: { cost: 10 } }] }, { timeline: [{ year: 1, score: 40, metrics: { cost: 30, invalid: NaN } }] }]);
    expect(rows[0].metrics).toEqual({ cost: 20 });
    expect(rows[0].metricRanges.cost).toEqual({ min: 10, max: 30 });
    expect(rows[0].score).toBe(30);
  });
});
