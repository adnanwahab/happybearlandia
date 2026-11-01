// Plan compiler: turns a Dear Congress plan (a synthesized package, a list of proposal
// ids, or an already-compiled PlanSpec) into a PlanSpec the simulator can execute.
//
// Dear Congress stays about human-readable proposals; HappyBearLandia owns what each
// proposal means computationally (POLICY_RULES in policy.js are the adapters).
//
// PlanSpec v1:
// {
//   kind: "planspec", version: 1,
//   planId, label, source,
//   actions: [{ id, proposalId, rule, label, startYear, costB, simulated }],
//   unsupported: [proposalId],   // in the plan but no simulator adapter yet
//   totalCostB,                  // sum of known annual costs ($B, illustrative)
// }

import { POLICY_RULES, computeEffectsForYear, resolveRuleForProposal } from "./policy.js";

const asArray = (x) => (Array.isArray(x) ? x : []);

function proposalIdFrom(item) {
  return item?.proposal?.id || item?.proposalId || item?.id || item?.proposal_id || null;
}

function slug(s) {
  return String(s || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";
}

function toAction(raw, defaultStartYear) {
  const proposalId = String(raw.proposalId || "").trim();
  if (!proposalId) return null;
  const mapped = resolveRuleForProposal(proposalId);
  const startYear = Number.isFinite(Number(raw.startYear)) ? Math.max(0, Math.round(Number(raw.startYear))) : defaultStartYear;
  const costB = raw.costB == null || raw.costB === "" ? NaN : Number(raw.costB);
  return {
    id: raw.id || proposalId,
    proposalId,
    rule: mapped?.id || null,
    label: raw.label || mapped?.rule?.label || proposalId,
    startYear,
    costB: Number.isFinite(costB) ? costB : null,
    simulated: !!mapped,
  };
}

function finish(planId, label, source, actions) {
  const seen = new Set();
  const deduped = actions.filter((a) => a && !seen.has(a.proposalId) && seen.add(a.proposalId));
  const totalCostB = deduped.reduce((s, a) => s + (a.costB || 0), 0);
  return {
    kind: "planspec",
    version: 1,
    planId,
    label,
    source,
    actions: deduped,
    unsupported: deduped.filter((a) => !a.simulated).map((a) => a.proposalId),
    totalCostB: Math.round(totalCostB * 1000) / 1000,
  };
}

/**
 * compilePlan(input, opts)
 *  input: PlanSpec | Dear Congress PackageResult ({ id, name, items: [{ proposal }] })
 *         | { proposalIds: [...] , label? } | string[] of proposal ids
 *  opts.startYear: year every action starts when the input doesn't say (default 1)
 */
export function compilePlan(input, opts = {}) {
  const defaultStartYear = Number.isFinite(opts.startYear) ? opts.startYear : 1;

  if (input?.kind === "planspec") {
    const errors = validatePlan(input);
    if (errors.length) throw new Error(`invalid PlanSpec: ${errors.join("; ")}`);
    return finish(input.planId, input.label || input.planId, input.source || "planspec",
      input.actions.map((a) => toAction(a, defaultStartYear)));
  }

  if (Array.isArray(input) || Array.isArray(input?.proposalIds)) {
    const ids = Array.isArray(input) ? input : input.proposalIds;
    const label = input?.label || "Custom plan";
    return finish(input?.planId || slug(label), label, input?.source || "custom",
      ids.map((proposalId) => toAction({ proposalId }, defaultStartYear)));
  }

  const items = asArray(input?.items || input?.proposals || input?.package?.items);
  if (input && (input.items || input.proposals || input.package)) {
    const label = input.name || input.title || input.label || "Dear Congress plan";
    return finish(`dc-${slug(input.id || label)}`, label, "dear-congress",
      items.map((item) => toAction({
        proposalId: proposalIdFrom(item),
        label: item?.proposal?.title,
        costB: item?.proposal?.costB ?? item?.costB,
      }, defaultStartYear)));
  }

  throw new Error("compilePlan: expected a PlanSpec, a Dear Congress package, or a list of proposal ids");
}

export function validatePlan(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") return ["not an object"];
  if (!spec.planId) errors.push("planId is required");
  if (!Array.isArray(spec.actions)) errors.push("actions must be an array");
  for (const [i, a] of asArray(spec.actions).entries()) {
    if (!a?.proposalId) errors.push(`actions[${i}].proposalId is required`);
    if (a?.startYear != null && !(Number(a.startYear) >= 0)) errors.push(`actions[${i}].startYear must be >= 0`);
  }
  return errors;
}

/**
 * What the simulator should run in a given year: the proposals that have started by
 * then and the year each was adopted (drives lag/ramp in policy.js).
 */
export function planForYear(spec, year) {
  const proposalIds = [];
  const adoptedYearByProposal = {};
  for (const a of spec?.actions || []) {
    if (!a.simulated || a.startYear > year) continue;
    proposalIds.push(a.proposalId);
    adoptedYearByProposal[a.proposalId] = a.startYear;
  }
  return { proposalIds, adoptedYearByProposal };
}

/** The simulator levers a plan sets in a given year (for dashboards and tests). */
export function planEffectsForYear(spec, year) {
  const { proposalIds, adoptedYearByProposal } = planForYear(spec, year);
  return computeEffectsForYear(proposalIds, year, adoptedYearByProposal).effects;
}

/** Proposal ids the simulator can execute today. */
export const SIMULATED_PROPOSALS = Object.freeze(Object.keys(POLICY_RULES));
