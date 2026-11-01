import { describe, expect, test } from "bun:test";
import { buildTown } from "./gen.js";
import { improvementSign, quantile, runPairedExperiment } from "./paired.js";

const town = () => buildTown({ lat: 29.7286, lng: -95.4746 }, null, { maxPeople: 40 });

describe("paired experiment helpers", () => {
  test("quantile interpolates", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.1)).toBeCloseTo(1, 6);
  });

  test("improvement direction follows the metric", () => {
    expect(improvementSign("avgMood", 2)).toBe(1);
    expect(improvementSign("avgWalkMinutes", 2)).toBe(-1);
    expect(improvementSign("displacedResidents", -3)).toBe(1);
  });
});

describe("runPairedExperiment", () => {
  test("empty plan has zero effect in every future", async () => {
    const res = await runPairedExperiment({ town: town(), plan: { proposalIds: [] }, seeds: 2, checkpoints: [1] });
    expect(res.final.avgMood.delta.mean).toBe(0);
    expect(res.futures.neutral).toBe(2);
  }, 30000);

  test("plan worlds pair with baseline worlds and drainage cuts storm displacement", async () => {
    const res = await runPairedExperiment({
      town: town(),
      plan: { kind: "planspec", planId: "flood", actions: [
        { proposalId: "f_drainage", startYear: 0 },
        { proposalId: "f_buyouts", startYear: 0 },
      ] },
      seeds: 3,
      checkpoints: [1, 6],
    });
    expect(res.meta.seeds).toBe(3);
    expect(res.series.map((s) => s.year)).toEqual([1, 6]);
    expect(res.runs).toHaveLength(3);
    // Same seed → same storm in both arms.
    expect(res.runs[0].years[6].stormSeverity).toBeGreaterThan(0);
    // Fully ramped flood plan never floods more people than no plan.
    for (const r of res.runs) expect(r.years[6].plan.displacedResidents).toBeLessThanOrEqual(r.years[6].baseline.displacedResidents);
    expect(res.final.displacedResidents.delta.mean).toBeLessThan(0);
    expect(res.futures.positive + res.futures.neutral + res.futures.negative).toBe(3);
  }, 60000);

  test("is deterministic for a given baseSeed", async () => {
    const opts = { plan: { proposalIds: ["t_bus"] }, seeds: 2, checkpoints: [2], baseSeed: "x" };
    const a = await runPairedExperiment({ town: town(), ...opts });
    const b = await runPairedExperiment({ town: town(), ...opts });
    expect(a.futures.deltas).toEqual(b.futures.deltas);
    expect(a.final.avgWalkMinutes).toEqual(b.final.avgWalkMinutes);
  }, 60000);
});
