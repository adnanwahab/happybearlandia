import { describe, expect, test } from "bun:test";
import { projectOutcomeLandscape } from "../world/outcome-landscape.js";

const simulations = Array.from({ length: 8 }, (_value, index) => ({
  worldId: `w${index}`,
  score: 20 + index * 8,
  status: index > 5 ? "positive" : index < 2 ? "negative" : "mixed",
  world: { conditions: { a: index, b: 8 - index, c: (index % 3) * 2 } },
}));

describe("outcome landscape", () => {
  test("projects simulations deterministically into finite 2D coordinates", () => {
    const a = projectOutcomeLandscape(simulations);
    const b = projectOutcomeLandscape(simulations);
    expect(a).toEqual(b);
    expect(a.points).toHaveLength(8);
    for (const point of a.points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(-1);
      expect(point.x).toBeLessThanOrEqual(1);
    }
  });

  test("keeps the source simulation attached to each point", () => {
    const projection = projectOutcomeLandscape(simulations);
    expect(projection.points[3].simulation.worldId).toBe("w3");
  });
});
