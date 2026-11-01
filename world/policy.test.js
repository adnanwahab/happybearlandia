import { describe, expect, test } from "bun:test";
import { computeEffectsForYear } from "./policy.js";

describe("policy timing by adoptedYear", () => {
  test("lag/ramp progress follows adoption year and resets on re-adopt", () => {
    const ids = ["f_buyouts"]; // lag 1, ramp 3, floodMitigationAdd 0.12

    const y3 = computeEffectsForYear(ids, 3, { f_buyouts: 3 }).effects.floodMitigation;
    const y5 = computeEffectsForYear(ids, 5, { f_buyouts: 3 }).effects.floodMitigation;
    const y7 = computeEffectsForYear(ids, 7, { f_buyouts: 3 }).effects.floodMitigation;

    expect(y3).toBeCloseTo(0, 6);       // progress 0
    expect(y5).toBeCloseTo(0.12 / 3, 6); // progress 1/3
    expect(y7).toBeCloseTo(0.12, 6);     // progress 1

    // dropped and re-added at year 6 -> clock restarts
    const y7ReAdd = computeEffectsForYear(ids, 7, { f_buyouts: 6 }).effects.floodMitigation;
    expect(y7ReAdd).toBeCloseTo(0, 6); // yearsInEffect=1, lag=1 => progress 0
  });
});
