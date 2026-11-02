// Versioned assumptions and tunable parameters for the legacy civic simulation.
// Keep these values separate from state transitions so scenarios remain inspectable.

export const SIMULATION_MODEL_VERSION = "legacy-civic-v2";

export const SIMULATION_PARAMETERS = Object.freeze({
  needs: Object.freeze({ hunger: 0.09, energy: 0.045, fun: 0.05, social: 0.04 }),
  mobility: Object.freeze({
    walkMetersPerMinute: 55,
    transitMetersPerMinute: 240,
    transitMinTripMeters: 450,
    transitBaseWaitMinutes: 9,
    transitWaitJitterMinutes: 2,
    transitServiceSpeedElasticity: 0.35,
    distancePenaltyMinutes: 5,
  }),
  economy: Object.freeze({
    workPayPerMinute: 0.30,
    eatOutCost: 12,
    groceriesCost: 30,
    groceriesMeals: 6,
    householdDailyBaseCost: 18,
    householdDailyPerMemberCost: 4,
    lowCashPerPerson: 60,
  }),
  experiment: Object.freeze({
    sampleDaysPerYear: 5,
  }),
});

// Compatible with the existing assumption-inspector.js variable shape.
export const SIMULATION_ASSUMPTIONS = Object.freeze([
  { id: "walk_speed", category: "infrastructure", label: "Walking speed", baseline: 55, range: { min: 35, max: 90 }, unit: "m/min", provenance: { type: "heuristic", confidence: 0.55 }, reason: "Local pedestrian movement speed; transit policies do not change it." },
  { id: "transit_speed", category: "infrastructure", label: "Transit in-vehicle speed", baseline: 240, range: { min: 100, max: 500 }, unit: "m/min", provenance: { type: "heuristic", confidence: 0.45 }, reason: "Local generalized transit speed before service improvements." },
  { id: "transit_wait", category: "infrastructure", label: "Baseline transit wait", baseline: 9, range: { min: 2, max: 30 }, unit: "minutes", provenance: { type: "heuristic", confidence: 0.45 }, reason: "Deterministic seeded wait used when transit beats walking." },
  { id: "household_daily_base_cost", category: "economy", label: "Household daily fixed cost", baseline: 18, range: { min: 0, max: 80 }, unit: "USD/day", provenance: { type: "heuristic", confidence: 0.35 }, reason: "Simplified housing, utility and recurring household obligations." },
  { id: "household_daily_member_cost", category: "economy", label: "Daily cost per household member", baseline: 4, range: { min: 0, max: 30 }, unit: "USD/person/day", provenance: { type: "heuristic", confidence: 0.35 }, reason: "Simplified recurring non-discretionary household spending." },
  { id: "work_pay", category: "labor", label: "Work pay", baseline: 0.30, range: { min: 0.05, max: 1.5 }, unit: "USD/min", provenance: { type: "heuristic", confidence: 0.35 }, reason: "Legacy local wage scale; earnings accrue to the household budget." },
  { id: "representative_week_days", category: "timing", label: "Representative sample days per year", baseline: 5, range: { min: 3, max: 30 }, unit: "days", provenance: { type: "heuristic", confidence: 0.5 }, reason: "The 10-year experiment samples a representative week each year while carrying state forward; it does not execute every day of the decade." },
]);

export const SIMULATION_LIMITATIONS = Object.freeze([
  "Synthetic residents and household budgets are illustrative, not calibrated microdata.",
  "Annual experiment points are representative multi-day samples with longitudinal state carry-forward, not 365 simulated days.",
  "Transit uses generalized walk/wait/in-vehicle time and does not yet model routes, fares, crowding, transfers, cars, or parking.",
  "Household costs are simplified recurring obligations and do not yet model debt, taxes, rent contracts, health expenses, or wealth.",
  "Flooding remains a parcel-ranking approximation using available flood-zone information and deterministic tie-breaking.",
]);
