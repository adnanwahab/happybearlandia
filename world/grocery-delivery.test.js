import { describe, expect, test } from "bun:test";
import { computeEffectsForYear, resolveRuleForProposal } from "./policy.js";
import { buildTown } from "./gen.js";
import { createWorld } from "./sim.js";

const town = () => buildTown({ lat: 29.7286, lng: -95.4746 }, null, { maxPeople: 200 });
const emptyFridges = (w) => w.people.filter((p) => p.yesterday?.emptyFridge).length;

describe("grocery delivery", () => {
  test("ramps in over a year and caps at full coverage", () => {
    expect(computeEffectsForYear(["g_delivery"], 0).effects.groceryDelivery).toBeCloseTo(0, 6);
    expect(computeEffectsForYear(["g_delivery"], 1).effects.groceryDelivery).toBeCloseTo(0.8, 6);
    expect(computeEffectsForYear(["g_delivery", "g_delivery"], 3).effects.groceryDelivery).toBe(1);
  });

  test("synthesized proposal ids about groceries map to it", () => {
    expect(resolveRuleForProposal("food_pantry_expansion")?.id).toBe("g_delivery");
    expect(resolveRuleForProposal("grocery_delivery")?.id).toBe("g_delivery");
  });

  test("worlds without the program are unchanged; with it, fewer fridges run empty", () => {
    const off1 = createWorld(town()), off2 = createWorld(town()), on = createWorld(town());
    on.groceryDelivery = 0.8;
    for (const w of [off1, off2, on]) w.step(4 * 1440);
    // deterministic: two worlds without the program are identical
    expect(off1.people.map((p) => p.needs.hunger)).toEqual(off2.people.map((p) => p.needs.hunger));
    expect(emptyFridges(on)).toBeLessThan(emptyFridges(off1));
  });
});
