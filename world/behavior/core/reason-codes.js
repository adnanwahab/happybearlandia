export const BEHAVIOR_REASON_CODES = Object.freeze({
  SEEDED_UTILITY_CHOICE: 'A seeded draw selected among the available scored alternatives.',
  NO_FEASIBLE_ALTERNATIVE: 'No modeled alternative satisfied the hard constraints.',
  HOUSING_COST_BURDEN: 'Housing costs exceeded the modeled burden threshold.',
  LOWER_HOUSING_COST: 'The alternative had lower housing costs.',
  SHORTER_COMMUTE: 'The alternative reduced modeled commute time.',
  MORE_SPACE: 'The alternative better matched household space needs.',
  HOUSEHOLD_GROWTH: 'Household size changed.',
  LEASE_ENDING: 'The modeled lease reached a reconsideration date.',
  JOB_CHANGED: 'Employment changed.',
  BETTER_TRANSIT_ACCESS: 'The alternative improved modeled transit access.',
  LOWER_TRAVEL_COST: 'The alternative reduced modeled trip cost.',
  HIGHER_TRAVEL_RELIABILITY: 'The alternative had better modeled reliability.',
  CAPACITY_UNAVAILABLE: 'The preferred alternative had no available capacity.',
  CAPACITY_FULL: 'The alternative was at capacity.',
  PRICE_EXCEEDS_MAX_BUDGET: 'The alternative exceeded the maximum modeled budget.',
  MODELED_DISPLACEMENT: 'The move met this model’s displacement definition.',
  TRANSIT_DENIED_BOARDING: 'Demand exceeded the modeled transit boarding capacity.',
});
export function explainReasonCodes(codes = []) {
  return [...new Set(codes)].map(code => ({ code, text: BEHAVIOR_REASON_CODES[code] || `Unrecognized recorded reason: ${String(code)}` }));
}
