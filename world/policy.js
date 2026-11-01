export const POLICY_RULES = {
  t_bus: { label: "Bus frequency", lagYears: 0, rampYears: 2, speedAdd: 0.45 },
  t_brt: { label: "BRT corridor", lagYears: 2, rampYears: 2, speedAdd: 0.8 },
  h_lots: { label: "Lot reform", lagYears: 1, rampYears: 5, housingGrowthAdd: 0.35 },
  h_vouchers: { label: "Housing vouchers", lagYears: 0, rampYears: 1, voucherMonthlyAdd: 35 },
  s_311: { label: "311 service", lagYears: 0, rampYears: 1, parkCleanupAdd: 0.65 },
  f_drainage: { label: "Drainage investment", lagYears: 2, rampYears: 4, floodMitigationAdd: 0.16 },
  f_buyouts: { label: "Floodplain buyouts", lagYears: 1, rampYears: 3, floodMitigationAdd: 0.12 },
  sb_filing: { label: "Small-biz filing", lagYears: 0, rampYears: 2, restockBoostAdd: 0.2, hiringBoostAdd: 0.1 },
  sb_payroll: { label: "Small-biz payroll", lagYears: 1, rampYears: 2, restockBoostAdd: 0.2, hiringBoostAdd: 0.2 },
  // Refills home fridges that are nearly empty (the "empty fridge" journal complaint).
  // Store-side proposals (sb_*) can't reach this: shelves rarely sell out, households just run out.
  g_delivery: { label: "Grocery delivery", lagYears: 0, rampYears: 1, groceryDeliveryAdd: 0.8 },
};

export const NOT_SIMULATED = new Set([
  "cc_credit", "cc_subsidy", "cc_licensing", "cc_public",
  "h_transit", "h_residency",
  "hc_chc", "hc_public", "mh_workforce", "mh_988",
  "i_roofs", "i_reinsurance", "fx_taxcut", "fx_review",
]);

export function effectProgress(lagYears, rampYears, year) {
  if (year < lagYears) return 0;
  if (!Number.isFinite(rampYears) || rampYears <= 0) return 1;
  return Math.max(0, Math.min(1, (year - lagYears) / rampYears));
}

export function resolveRuleForProposal(pid0) {
  const pid = String(pid0 || "").toLowerCase();
  if (POLICY_RULES[pid]) return { id: pid, rule: POLICY_RULES[pid] };
  if (NOT_SIMULATED.has(pid)) return null;
  if (pid.includes("brt")) return { id: "t_brt", rule: POLICY_RULES.t_brt };
  if (pid.includes("bus") || pid.includes("transit")) return { id: "t_bus", rule: POLICY_RULES.t_bus };
  if (pid.includes("lot") || pid.includes("zoning") || pid.includes("housing")) return { id: "h_lots", rule: POLICY_RULES.h_lots };
  if (pid.includes("voucher")) return { id: "h_vouchers", rule: POLICY_RULES.h_vouchers };
  if (pid.includes("311") || pid.includes("clean")) return { id: "s_311", rule: POLICY_RULES.s_311 };
  if (pid.includes("drain") || pid.includes("flood")) return { id: "f_drainage", rule: POLICY_RULES.f_drainage };
  if (pid.includes("buyout")) return { id: "f_buyouts", rule: POLICY_RULES.f_buyouts };
  if (pid.includes("payroll")) return { id: "sb_payroll", rule: POLICY_RULES.sb_payroll };
  if (pid.includes("grocer") || pid.includes("pantry") || pid.includes("delivery") || pid.includes("food_access")) return { id: "g_delivery", rule: POLICY_RULES.g_delivery };
  if (pid.includes("filing") || pid.includes("permit") || pid.includes("small") || pid.startsWith("sb_")) return { id: "sb_filing", rule: POLICY_RULES.sb_filing };
  return null;
}

export function computeEffectsForYear(proposalIds, year, adoptedYearByProposal = null) {
  const effects = {
    speedMult: 1,
    floodMitigation: 0,
    housingGrowth: 0,
    voucherMonthly: 0,
    parkCleanupBoost: 0,
    restockBoost: 0,
    hiringBoost: 0,
    groceryDelivery: 0,
  };
  const unsupported = [];

  for (const pid of proposalIds || []) {
    const mapped = resolveRuleForProposal(pid);
    if (!mapped) {
      unsupported.push(pid);
      continue;
    }
    const adoptedYear = adoptedYearByProposal && Number.isFinite(adoptedYearByProposal[pid])
      ? Number(adoptedYearByProposal[pid])
      : 0;
    const yearsInEffect = year - adoptedYear;
    const p = effectProgress(mapped.rule.lagYears, mapped.rule.rampYears, yearsInEffect);
    effects.speedMult += (mapped.rule.speedAdd || 0) * p;
    effects.floodMitigation += (mapped.rule.floodMitigationAdd || 0) * p;
    effects.housingGrowth += (mapped.rule.housingGrowthAdd || 0) * p;
    effects.voucherMonthly += (mapped.rule.voucherMonthlyAdd || 0) * p;
    effects.parkCleanupBoost += (mapped.rule.parkCleanupAdd || 0) * p;
    effects.restockBoost += (mapped.rule.restockBoostAdd || 0) * p;
    effects.hiringBoost += (mapped.rule.hiringBoostAdd || 0) * p;
    effects.groceryDelivery += (mapped.rule.groceryDeliveryAdd || 0) * p;
  }

  effects.speedMult = Math.min(2.6, Math.max(1, effects.speedMult));
  effects.floodMitigation = Math.min(0.45, Math.max(0, effects.floodMitigation));
  effects.housingGrowth = Math.min(1.8, Math.max(0, effects.housingGrowth));
  effects.voucherMonthly = Math.min(120, Math.max(0, effects.voucherMonthly));
  effects.parkCleanupBoost = Math.min(1.2, Math.max(0, effects.parkCleanupBoost));
  effects.restockBoost = Math.min(1.1, Math.max(0, effects.restockBoost));
  effects.hiringBoost = Math.min(0.8, Math.max(0, effects.hiringBoost));
  effects.groceryDelivery = Math.min(1, Math.max(0, effects.groceryDelivery));

  return { effects, unsupported: Array.from(new Set(unsupported)) };
}

export function derivePolicyProfile(name, id, proposalIds, source = "dear-congress") {
  const full = computeEffectsForYear(proposalIds, 10);
  return {
    id,
    label: name,
    source,
    proposalIds,
    effects: full.effects,
    unsupported: full.unsupported,
  };
}
