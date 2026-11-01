import { describe, expect, test } from "bun:test";
import { buildTown } from "./gen.js";
import { createWorld } from "./sim.js";

const origin = { lat: 29.7286, lng: -95.4746 };

function moodAfterDay(runSeed) {
  const town = buildTown(origin, null, { maxPeople: 60 });
  const w = createWorld(town, { startMinute: 0, runSeed });
  w.step(1440);
  return w.summary().mood;
}

describe("createWorld runSeed", () => {
  test("no runSeed is unchanged and deterministic", () => {
    expect(moodAfterDay(undefined)).toBe(moodAfterDay(null));
  });

  test("same runSeed repeats, different runSeeds diverge", () => {
    expect(moodAfterDay("a")).toBe(moodAfterDay("a"));
    expect(moodAfterDay("a")).not.toBe(moodAfterDay("b"));
  });
});
