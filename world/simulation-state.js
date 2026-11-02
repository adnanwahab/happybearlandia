import { SIMULATION_MODEL_VERSION } from "./simulation-parameters.js";

export const LONGITUDINAL_STATE_VERSION = "legacy-civic-longitudinal.v1";

function idFor(person) {
  return String(person?.householdId || `person:${person?.id ?? "unknown"}`);
}

export function initializeHouseholds(people = []) {
  const households = {};
  for (let index = 0; index < people.length; index++) {
    const person = people[index];
    const id = idFor(person);
    const household = households[id] ||= { id, members: [], cash: 0, stressedDays: 0, lastDailyCost: 0, lastShortfall: 0 };
    household.members.push(index);
    household.cash += Math.max(0, Number(person?.money || 0));
  }
  return households;
}

export function householdFor(world, person) {
  return world?.households?.[idFor(person)] || null;
}

export function syncHouseholdMoney(world, householdId) {
  const household = world?.households?.[householdId];
  if (!household) return;
  const members = household.members || [];
  const perPerson = household.cash / Math.max(1, members.length);
  for (const index of members) if (world.people?.[index]) world.people[index].money = perPerson;
}

export function syncAllHouseholdMoney(world) {
  for (const id of Object.keys(world?.households || {})) syncHouseholdMoney(world, id);
}

export function householdCanAfford(world, person, amount) {
  const household = householdFor(world, person);
  if (!household) return Number(person?.money || 0) >= amount;
  return household.cash >= Math.max(0, Number(amount || 0));
}

export function spendHousehold(world, person, amount) {
  const cost = Math.max(0, Number(amount || 0));
  const household = householdFor(world, person);
  if (!household) { person.money = Math.max(0, Number(person?.money || 0) - cost); return; }
  household.cash = Math.max(0, household.cash - cost);
  syncHouseholdMoney(world, household.id);
}

export function earnHousehold(world, person, amount) {
  const income = Math.max(0, Number(amount || 0));
  const household = householdFor(world, person);
  if (!household) { person.money = Math.max(0, Number(person?.money || 0) + income); return; }
  household.cash += income;
  syncHouseholdMoney(world, household.id);
}

export function scaleHouseholdCash(world, multiplier) {
  const k = Math.max(0, Number(multiplier || 0));
  for (const household of Object.values(world?.households || {})) household.cash *= k;
  syncAllHouseholdMoney(world);
}

export function applyDailyHouseholdCosts(world, parameters) {
  const base = Math.max(0, Number(parameters?.householdDailyBaseCost || 0));
  const perMember = Math.max(0, Number(parameters?.householdDailyPerMemberCost || 0));
  let stressed = 0;
  for (const household of Object.values(world?.households || {})) {
    const count = Math.max(1, household.members?.length || 0);
    const cost = base + perMember * count;
    const paid = Math.min(household.cash, cost);
    const shortfall = Math.max(0, cost - paid);
    household.cash -= paid;
    household.lastDailyCost = cost;
    household.lastShortfall = shortfall;
    if (shortfall > 0) { household.stressedDays += 1; stressed++; }
    for (const index of household.members || []) {
      const person = world.people?.[index];
      if (!person?.today) continue;
      person.today.budgetStress = shortfall > 0;
      person.today.budgetShortfall = shortfall / count;
    }
    syncHouseholdMoney(world, household.id);
  }
  return stressed;
}

export function applyMonthlyVoucher(world, monthlyAmount, lowCashPerPerson) {
  const amount = Math.max(0, Number(monthlyAmount || 0));
  if (!amount) return 0;
  let supported = 0;
  for (const household of Object.values(world?.households || {})) {
    const count = Math.max(1, household.members?.length || 0);
    if (household.cash / count > Math.max(0, Number(lowCashPerPerson || 0))) continue;
    household.cash += amount;
    supported++;
    syncHouseholdMoney(world, household.id);
  }
  return supported;
}

function persistentBuildingState(state = {}) {
  const out = { ...state };
  delete out.visitors;
  delete out.flooded;
  return out;
}

export function captureLongitudinalState(world) {
  return {
    schemaVersion: LONGITUDINAL_STATE_VERSION,
    modelVersion: SIMULATION_MODEL_VERSION,
    buildings: (world?.buildings || []).map((building) => ({ index: building.index, state: persistentBuildingState(building.state) })),
    people: (world?.people || []).map((person) => ({
      id: person.id,
      home: person.home,
      x: person.x,
      z: person.z,
      needs: { ...(person.needs || {}) },
      walkHistory: [...(person.walkHistory || [])],
      walkMinutesAvg3d: Number(person.walkMinutesAvg3d || 0),
      travelHistory: [...(person.travelHistory || [])],
      travelMinutesAvg3d: Number(person.travelMinutesAvg3d || 0),
    })),
    households: Object.fromEntries(Object.entries(world?.households || {}).map(([id, household]) => [id, {
      id, members: [...(household.members || [])], cash: Number(household.cash || 0), stressedDays: Number(household.stressedDays || 0),
      lastDailyCost: Number(household.lastDailyCost || 0), lastShortfall: Number(household.lastShortfall || 0),
    }])),
  };
}

export function restoreLongitudinalState(world, snapshot) {
  if (!snapshot || snapshot.schemaVersion !== LONGITUDINAL_STATE_VERSION) return false;
  const peopleById = new Map((snapshot.people || []).map((row) => [row.id, row]));
  for (const person of world.people || []) {
    const saved = peopleById.get(person.id);
    if (!saved) continue;
    if (Number.isInteger(saved.home) && world.buildings?.[saved.home]) person.home = saved.home;
    if (Number.isFinite(saved.x)) person.x = saved.x;
    if (Number.isFinite(saved.z)) person.z = saved.z;
    if (saved.needs) person.needs = { ...person.needs, ...saved.needs };
    person.walkHistory = [...(saved.walkHistory || [])].slice(-3);
    person.walkMinutesAvg3d = Number(saved.walkMinutesAvg3d || 0);
    person.travelHistory = [...(saved.travelHistory || [])].slice(-3);
    person.travelMinutesAvg3d = Number(saved.travelMinutesAvg3d || 0);
  }
  for (const saved of snapshot.buildings || []) {
    const building = world.buildings?.[saved.index];
    if (!building?.state) continue;
    Object.assign(building.state, saved.state || {});
    building.state.visitors = 0;
    building.state.flooded = false;
  }
  for (const [id, saved] of Object.entries(snapshot.households || {})) {
    const household = world.households?.[id];
    if (!household) continue;
    household.cash = Math.max(0, Number(saved.cash || 0));
    household.stressedDays = Math.max(0, Number(saved.stressedDays || 0));
    household.lastDailyCost = Math.max(0, Number(saved.lastDailyCost || 0));
    household.lastShortfall = Math.max(0, Number(saved.lastShortfall || 0));
  }
  syncAllHouseholdMoney(world);
  return true;
}
