import { describe, expect, test } from "bun:test";
import { buildTown } from "./gen.js";
import {
  coverage, defaultCheckpoints, metricWeights, realitySeed, runMonteCarlo, runReality, snapshotToPlan, summarizeRealities,
} from "./multiverse.js";

const snapshot = {
  id: "sim_test",
  schemaVersion: 1,
  needs: [{ id: "transit", label: "Transit", weight: 0.7 }, { id: "childcare", label: "Childcare", weight: 0.3 }],
  plan: {
    id: "A",
    label: "Balanced",
    proposalIds: ["t_bus", "f_drainage", "cc_licensing"],
    items: [
      { id: "t_bus", title: "Frequent buses", costB: 4.1 },
      { id: "f_drainage", title: "Bayou drainage", costB: 2 },
      { id: "cc_licensing", title: "Daycare licensing", costB: 0.05 },
    ],
  },
};

const town = () => buildTown({ lat: 29.7286, lng: -95.4746 }, null, { maxPeople: 30 });

describe("multiverse helpers", () => {
  test("seeds and checkpoints", () => {
    expect(realitySeed(1938291, 284)).toBe("1938291:reality:284");
    expect(defaultCheckpoints(10)).toEqual([1, 5, 10]);
    expect(defaultCheckpoints(1)).toEqual([1]);
    expect(defaultCheckpoints(2)).toEqual([1, 2]);
  });

  test("snapshot → plan keeps Dear Congress titles and reports coverage", () => {
    const spec = snapshotToPlan(snapshot);
    expect(spec.label).toBe("Balanced");
    expect(spec.actions[0].label).toBe("Frequent buses");
    const c = coverage(spec);
    expect([c.total, c.modeled, c.notModeled]).toEqual([3, 2, 1]);
    expect(c.notModeledItems[0].label).toBe("Daycare licensing");
  });

  test("journal needs weight their metrics; unmapped needs are ignored", () => {
    const eq = metricWeights([]);
    expect(eq.source).toBe("equal");
    const j = metricWeights(snapshot.needs);
    expect(j.source).toBe("journal");
    expect(j.weights.avgWalkMinutes).toBeGreaterThan(j.weights.displacedResidents);
    expect(Object.values(j.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
});

describe("realities", () => {
  test("a reality replays exactly from its seed", async () => {
    const spec = snapshotToPlan(snapshot);
    const a = await runReality({ town: town(), spec, index: 7, baseSeed: "b", checkpoints: [3] });
    const b = await runReality({ town: town(), spec, index: 7, baseSeed: "b", checkpoints: [3] });
    expect(a).toEqual(b);
    expect(a.delta.avgWalkMinutes).toBeLessThan(0);
  }, 30000);

  test("summary counts, percentiles, best/median/worst", async () => {
    const res = await runMonteCarlo({ town: town(), snapshot, runs: 5, checkpoints: [3], baseSeed: "x" });
    const s = res.summary;
    expect(s.count).toBe(5);
    expect(s.verdicts.improved + s.verdicts.mixed + s.verdicts.worse).toBe(5);
    expect(s.metrics.avgWalkMinutes.improved).toBe(5);
    expect(s.metrics.avgWalkMinutes.histogram.counts.reduce((a, b) => a + b, 0)).toBe(5);
    expect(s.weightsSource).toBe("journal");
    expect([s.best, s.median, s.worst].every((i) => i >= 0 && i < 5)).toBe(true);
    const scoreOf = (i) => s.realities.find((r) => r.index === i).score;
    expect(scoreOf(s.best)).toBeGreaterThanOrEqual(scoreOf(s.worst));
  }, 60000);

  test("summarizing in any order gives the same answer", () => {
    const fake = (index, walk) => ({
      index,
      delta: { avgMood: 0, avgWalkMinutes: walk, overWalkComplaint: 0, displacedResidents: 0, soldOutEvents: 0, avgParkLitter: 0 },
      years: { 1: { baseline: { avgMood: 80, avgWalkMinutes: 60, overWalkComplaint: 50, displacedResidents: 10, soldOutEvents: 0, avgParkLitter: 5 } } },
    });
    const rs = [fake(0, -10), fake(1, 5), fake(2, -1)];
    const a = summarizeRealities(rs);
    const b = summarizeRealities([...rs].reverse());
    expect(a).toEqual(b);
    expect(a.best).toBe(0);
    expect(a.worst).toBe(1);
    expect(a.metrics.avgWalkMinutes.worse).toBe(1);
  });
});
