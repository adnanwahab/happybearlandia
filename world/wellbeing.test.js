import { describe, expect, test } from "bun:test";
import { frictions, wellbeing, wellbeingHex, createDayMeter } from "./wellbeing.js";

const person = (over = {}) => ({
  needs: { hunger: 80, energy: 80, fun: 80, social: 80 },
  walkMinutesAvg3d: 0,
  yesterday: { soldOutAt: [], emptyFridge: false, dirtyParkVisits: 0, displaced: false, homeFlooded: false },
  ...over,
});

describe("wellbeing", () => {
  test("no frictions scores mood", () => {
    expect(wellbeing(person())).toBe(80);
  });

  test("long commutes, lost homes and empty shelves cost points", () => {
    const p = person({ walkMinutesAvg3d: 100, yesterday: { soldOutAt: ["Corner Mart"], emptyFridge: true, dirtyParkVisits: 1, displaced: true } });
    const f = frictions(p);
    expect(f.commute).toBeGreaterThan(0);
    expect(f.home).toBe(25);
    expect(f.groceries).toBe(16);
    expect(f.parks).toBe(4);
    expect(wellbeing(p)).toBeLessThan(40);
  });

  test("score is clamped to 0–100", () => {
    const p = person({ needs: { hunger: 0, energy: 0, fun: 0, social: 0 }, walkMinutesAvg3d: 500, yesterday: { displaced: true } });
    expect(wellbeing(p)).toBe(0);
  });

  test("day meter averages mood across samples", () => {
    const p = person();
    const m = createDayMeter(1);
    m.sample([p]);
    p.needs = { hunger: 40, energy: 40, fun: 40, social: 40 };
    m.sample([p]);
    expect(m.result([p])[0]).toBe(60);
  });

  test("color runs red to green", () => {
    const red = wellbeingHex(0), green = wellbeingHex(100);
    expect(red >> 16).toBeGreaterThan(green >> 16);
    expect((green >> 8) & 0xff).toBeGreaterThan(red & 0xff);
  });
});
