/** Narrow adapter registry, not legal interpretation or empirical effect sizes.
 * Never map an unsupported domain into housing just to generate a forecast.
 * Source IDs identify policy proposals; titles remain exact source text.
 */
export const CLAUSE_MAPPINGS = Object.freeze({
  h_lots: {
    supported: true, type: "upzone", amount: 4, allocation: "equal-districts",
    label: "Illustrative parcel entitlement increase",
    assumption: "Four additional permitted homes per modeled parcel at full compliance; the proposal supplies no numeric density effect.",
    modeledMetrics: ["housingUnits", "availableUnits", "meanRent", "completedProjects"],
    limitations: ["The city engine models parcel capacity/FAR, not actual lot subdivision, parking-code language, legal adoption or guaranteed construction.", "Entitlements are not completed homes. Private development still faces financing, construction capacity, utilities and market feasibility."],
  },
  f_drainage: {
    supported: true, type: "resilience", amount: 0.12, allocation: "equal-districts",
    label: "Illustrative flood-resilience construction",
    assumption: "A completed resilience project adds 0.12 to each synthetic district's flood-resilience index at full compliance, capped by the engine.",
    modeledMetrics: ["unhoused", "availableUnits", "utilityFailures", "balance", "completedProjects"],
    limitations: ["A resilience-index proxy is not a hydraulic bayou/detention model. No real parcel flood protection or structures-saved count is inferred.", "Benefits depend on recorded flood shocks; without a modeled flood, avoided flood damage is not fabricated."],
  },
  t_brt: {
    supported: true, type: "transit", amount: 30, allocation: "single-synthetic-hub",
    label: "Illustrative district transit capacity project",
    assumption: "A single synthetic hub gains 30 rider-capacity units per incident transit link; the existing engine also multiplies free travel time by 0.8 on completion.",
    modeledMetrics: ["meanTravelMinutes", "employed", "balance", "completedProjects"],
    limitations: ["The source's three busiest corridors are not identified or reconstructed. This is a coarse synthetic district-hub proxy, not dedicated-lane physics or a real METRO ridership forecast.", "One hub is selected deterministically to avoid upgrading each shared link twice through both endpoints. Operating expenses follow the actual city engine."],
  },
});
export const UNSUPPORTED_CLAUSE_REASONS = Object.freeze({
  s_311: "The engine does not model 311 requests, street-repair queues or a 30-day service standard.",
  cc_licensing: "No childcare provider licensing or childcare waitlist mechanism exists in this city engine.",
  sb_filing: "No tax-filing compliance-hour or IRS form-change mechanism exists; reduced paperwork is not silently converted into a tax cut.",
  fx_review: "No program-performance audit or automatic fiscal sunset mechanism exists. Deficit savings are unavailable rather than assumed.",
  h_vouchers: "No housing-voucher eligibility, transfers or eviction-filing mechanism exists. Vouchers are not silently substituted with new housing construction.",
  cc_subsidy: "No childcare subsidy, household childcare expenditure or provider reimbursement mechanism exists; childcare is not housing.",
  mh_988: "No crisis-line staffing, clinical outcome or mobile-crisis response-time mechanism exists. Mental-health effects are unavailable.",
});
export function mappingForClause(id) {
  const mapping = CLAUSE_MAPPINGS[id];
  return mapping ? structuredClone(mapping) : { supported: false, label: "Forecast unavailable", modeledMetrics: [],
    limitations: [UNSUPPORTED_CLAUSE_REASONS[id] || "No reviewed adapter maps this proposal ID to an implemented city-engine mechanism."] };
}
