import { describe, expect, test } from "bun:test";
import { journalFor } from "./journal.js";

function basePerson() {
  return {
    id: 7,
    home: 1,
    walkMinutesAvg3d: 0,
    today: {
      day: 3,
      walkMinutes: 0,
      soldOutAt: [],
      emptyFridge: false,
      dirtyParkVisits: 0,
      displaced: false,
      homeFlooded: false,
      highWalk: false,
    },
  };
}

function baseCtx() {
  return {
    tileKey: "40.726,-73.981",
    buildingsById: {
      1: { state: { flooded: false } },
    },
    policyLabel: "Balanced",
    year: 2,
  };
}

describe("journalFor", () => {
  test("displaced resident -> contains flood", () => {
    const p = basePerson();
    p.today.displaced = true;
    const text = journalFor(p, baseCtx());
    expect(text).toBeTruthy();
    expect(String(text).toLowerCase()).toContain("flood");
  });

  test("high walkMinutes -> contains commute or bus", () => {
    const p = basePerson();
    p.walkMinutesAvg3d = 75;
    const text = journalFor(p, baseCtx());
    expect(text).toBeTruthy();
    const t = String(text).toLowerCase();
    expect(t.includes("commute") || t.includes("bus")).toBe(true);
  });

  test("2+ dirty park visits -> contains 311", () => {
    const p = basePerson();
    p.today.dirtyParkVisits = 2;
    const text = journalFor(p, baseCtx());
    expect(text).toBeTruthy();
    expect(String(text)).toContain("311");
  });

  test("sold-out place -> mentions place name and avoids forbidden words", () => {
    const p = basePerson();
    p.today.soldOutAt = ["Garcia Market"];
    const text = journalFor(p, baseCtx());
    expect(text).toBeTruthy();
    const t = String(text);
    const lower = t.toLowerCase();
    expect(t).toContain("Garcia Market");
    for (const bad of ["restaurant", "hire", "payroll", "taxes", "rent", "insurance", "please"]) {
      expect(lower.includes(bad)).toBe(false);
    }
  });

  test("nothing happened -> null", () => {
    const p = basePerson();
    const text = journalFor(p, baseCtx());
    expect(text).toBeNull();
  });

  test("same person + same day -> identical text", () => {
    const p = basePerson();
    p.today.displaced = true;
    p.today.dirtyParkVisits = 2;
    p.today.soldOutAt = ["Garcia Market"];
    const a = journalFor(p, baseCtx());
    const b = journalFor(p, baseCtx());
    expect(a).toBe(b);
  });

  test("walkMinutesAvg3d at 20 does not create transit complaint", () => {
    const p = basePerson();
    p.walkMinutesAvg3d = 20;
    const text = journalFor(p, baseCtx());
    expect(text).toBeNull();
  });
});
