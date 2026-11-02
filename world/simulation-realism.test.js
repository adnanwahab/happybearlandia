import { describe, expect, test } from "bun:test";
import { buildTown } from "./gen.js";
import { createWorld } from "./sim.js";
import { SIMULATION_ASSUMPTIONS, SIMULATION_PARAMETERS } from "./simulation-parameters.js";
import { applyMonthlyVoucher, captureLongitudinalState, restoreLongitudinalState, spendHousehold, syncAllHouseholdMoney } from "./simulation-state.js";
import { observeWorld } from "./simulation-observations.js";

function makeTown(maxPeople = 80) {
  return buildTown({ lat: 29.7286, lng: -95.4746 }, { source: "none" }, { maxPeople });
}

describe("simulation realism v2", () => {
  test("assumptions are explicit and parameters stay versioned outside transitions", () => {
    expect(SIMULATION_ASSUMPTIONS.length).toBeGreaterThanOrEqual(6);
    expect(SIMULATION_PARAMETERS.experiment.sampleDaysPerYear).toBe(5);
    expect(SIMULATION_ASSUMPTIONS.some((row) => row.id === "transit_wait")).toBe(true);
  });

  test("household purchases share one budget", () => {
    const world = createWorld(makeTown(), { startMinute: 0, runSeed: "household-budget" });
    const household = Object.values(world.households).find((row) => row.members.length > 1) || Object.values(world.households)[0];
    const person = world.people[household.members[0]];
    const before = household.cash;
    spendHousehold(world, person, 10);
    expect(household.cash).toBeCloseTo(Math.max(0, before - 10), 8);
    const perPerson = household.cash / household.members.length;
    for (const index of household.members) expect(world.people[index].money).toBeCloseTo(perPerson, 8);
  });

  test("voucher support is deposited once per eligible household, not once per person", () => {
    const world = createWorld(makeTown(), { startMinute: 0, runSeed: "voucher" });
    const households = Object.values(world.households);
    for (const row of households) row.cash = 100000;
    const target = households.find((row) => row.members.length > 1) || households[0];
    target.cash = 0;
    syncAllHouseholdMoney(world);
    const supported = applyMonthlyVoucher(world, 120, 60);
    expect(supported).toBe(1);
    expect(target.cash).toBe(120);
  });

  test("longitudinal state round-trips deterministic household, resident and building state", () => {
    const town = makeTown();
    const world = createWorld(town, { startMinute: 0, runSeed: "state-a" });
    const person = world.people[0];
    const household = world.households[person.householdId];
    household.cash = 123.45;
    person.travelHistory = [12, 18, 24];
    person.travelMinutesAvg3d = 18;
    world.buildings[0].state.litter = 77;
    const home = world.buildings.find((b) => b.kind === "home" && b.index !== person.home);
    if (home) person.home = home.index;
    const snapshot = captureLongitudinalState(world);

    const fresh = createWorld(makeTown(), { startMinute: 0, runSeed: "state-b" });
    expect(restoreLongitudinalState(fresh, snapshot)).toBe(true);
    const restored = fresh.people.find((row) => row.id === person.id);
    expect(restored.travelHistory).toEqual([12, 18, 24]);
    expect(restored.travelMinutesAvg3d).toBe(18);
    expect(fresh.households[person.householdId].cash).toBeCloseTo(123.45, 8);
    expect(fresh.buildings[0].state.litter).toBe(77);
    expect(fresh.buildings[0].state.flooded).toBe(false);
  });

  test("observations are derived without mutating state", () => {
    const world = createWorld(makeTown(), { startMinute: 0, runSeed: "observations" });
    for (const person of world.people) {
      person.travelMinutesAvg3d = 20;
      person.walkMinutesAvg3d = 8;
      person.yesterday = { travelMinutes: 20, transitMinutes: 8, transitWaitMinutes: 2 };
    }
    const before = JSON.stringify(captureLongitudinalState(world));
    const observed = observeWorld(world);
    expect(observed.avgCommuteMinutes).toBeCloseTo(20, 8);
    expect(observed.avgWalkMinutes).toBeCloseTo(8, 8);
    expect(observed.transitShare).toBeCloseTo(0.5, 8);
    expect(JSON.stringify(captureLongitudinalState(world))).toBe(before);
  });
});
