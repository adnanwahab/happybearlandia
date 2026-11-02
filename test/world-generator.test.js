import { describe, expect, test } from "bun:test";
import { generateWorlds } from "../world/world-generator.js";

const experiment = {
  id: "exp_demo",
  experiment: { runs: 3, seed: 42 },
  worldModel: {
    variables: [
      { id: "a", baseline: 0.5, range: { min: 0, max: 1 }, distribution: { type: "triangular", min: 0, mode: 0.5, max: 1 }, locked: false },
      { id: "locked", baseline: 7, range: { min: 0, max: 10 }, distribution: { type: "uniform" }, locked: true },
    ],
  },
};

describe("seeded world generator", () => {
  test("is deterministic for the same experiment and seed", () => {
    expect(generateWorlds(experiment)).toEqual(generateWorlds(experiment));
  });

  test("changes when the seed changes", () => {
    const a = generateWorlds(experiment, { seed: 1 });
    const b = generateWorlds(experiment, { seed: 2 });
    expect(a.worlds[0].conditions.a).not.toBe(b.worlds[0].conditions.a);
  });

  test("keeps locked variables fixed and sampled variables in range", () => {
    const batch = generateWorlds(experiment, { runs: 100 });
    for (const world of batch.worlds) {
      expect(world.conditions.locked).toBe(7);
      expect(world.conditions.a).toBeGreaterThanOrEqual(0);
      expect(world.conditions.a).toBeLessThanOrEqual(1);
    }
  });

  test("applies inspector overrides before sampling", () => {
    const batch = generateWorlds(experiment, {
      runs: 4,
      overrides: { a: { baseline: 0.8, min: 0.7, max: 0.9, locked: true } },
    });
    expect(batch.worlds.every((world) => world.conditions.a === 0.8)).toBe(true);
  });
});
