// Read-only derived outputs. This module must not mutate world state.

export function observeMobility(world) {
  const people = world?.people || [];
  if (!people.length) return { avgCommuteMinutes: 0, avgWalkMinutes: 0, transitShare: 0 };
  let commute = 0, walk = 0, transit = 0, travel = 0;
  for (const person of people) {
    const day = person.yesterday || person.today || {};
    commute += Number(person.travelMinutesAvg3d ?? person.walkMinutesAvg3d ?? day.travelMinutes ?? day.walkMinutes ?? 0);
    walk += Number(person.walkMinutesAvg3d ?? day.walkMinutes ?? 0);
    transit += Number(day.transitMinutes || 0) + Number(day.transitWaitMinutes || 0);
    travel += Number(day.travelMinutes || 0);
  }
  return {
    avgCommuteMinutes: commute / people.length,
    avgWalkMinutes: walk / people.length,
    transitShare: travel > 0 ? transit / travel : 0,
  };
}

export function observeHouseholds(world) {
  const households = Object.values(world?.households || {});
  if (!households.length) return { householdCount: 0, avgHouseholdCash: 0, avgHouseholdCashPerPerson: 0, budgetStressedHouseholds: 0, budgetStressRate: 0 };
  let cash = 0, people = 0, stressed = 0;
  for (const household of households) {
    cash += Number(household.cash || 0);
    people += Math.max(1, household.members?.length || 0);
    if (Number(household.lastShortfall || 0) > 0) stressed++;
  }
  return {
    householdCount: households.length,
    avgHouseholdCash: cash / households.length,
    avgHouseholdCashPerPerson: cash / Math.max(1, people),
    budgetStressedHouseholds: stressed,
    budgetStressRate: stressed / households.length,
  };
}

export function observeWorld(world) {
  return {
    avgMood: Number(world?.summary?.().mood || 0),
    ...observeMobility(world),
    ...observeHouseholds(world),
  };
}
