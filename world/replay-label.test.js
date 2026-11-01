import { describe, expect, test } from "bun:test";
import { replayStormStrengthLabel } from "./replay-label.js";

describe("replay storm-strength label", () => {
  test("with outcomes unavailable, label contains simulated and not FEMA", () => {
    const txt = replayStormStrengthLabel(false);
    expect(txt.toLowerCase()).toContain("simulated");
    expect(txt.toLowerCase()).not.toContain("fema");
  });
});
