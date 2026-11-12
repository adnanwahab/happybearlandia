import { describe, expect, test } from "bun:test";
import { currentModelDescriptor, modelCompatibility } from "../world/model-registry.js";
import { buildReproducibilityManifest, compareReproducibility, fingerprint } from "../world/reproducibility.js";

describe("model registry and reproducibility", () => {
  test("fingerprints are stable under object key ordering", () => {
    expect(fingerprint({ b: 2, a: 1 })).toBe(fingerprint({ a: 1, b: 2 }));
  });
  test("captures manifest, world, and result hashes", () => {
    const input = {
      experiment: { plan: { id: "p1" }, assumptions: [], worldModel: {}, model: currentModelDescriptor(), experiment: { seed: 42 } },
      worldBatch: { seed: 42, worlds: [{ id: "w1" }] },
      simulationBatch: { adapter: { id: "hbl" }, simulations: [{ worldId: "w1", score: 10 }] },
    };
    const a = buildReproducibilityManifest(input);
    const b = buildReproducibilityManifest(input);
    expect(compareReproducibility(a, b).exact).toBe(true);
  });
  test("reports model version mismatches", () => {
    const saved = currentModelDescriptor();
    const current = { ...saved, simulator: { ...saved.simulator, version: "99.0.0" } };
    expect(modelCompatibility(saved, current).compatible).toBe(false);
  });
});

test("fingerprints survive JSON persistence of optional fields", () => {
  const input = { a: undefined, b: [{ c: undefined, d: 2 }, undefined] };
  expect(fingerprint(input)).toBe(fingerprint(JSON.parse(JSON.stringify(input))));
});
