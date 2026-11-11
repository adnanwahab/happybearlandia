import { decodePlan, futureURL, normalizePlan, planCost, POLICY_CATALOG, runPlan } from '../model.js';

const policies = new Map(POLICY_CATALOG.map(policy => [policy.id, policy]));
const futurePath = '/world/invention/future';
export const measures = [
  { key: 'meanCommuteMinutes', label: 'Mean recorded commute', unit: 'min' },
  { key: 'unemploymentRate', label: 'Unemployment', unit: '%', multiplier: 100, deltaUnit: 'percentage points' },
  { key: 'unhoused', label: 'Unhoused households', unit: 'households' },
  { key: 'meanRent', label: 'Mean unit rent', unit: 'modeled USD/month' },
  { key: 'housingUnits', label: 'Housing units', unit: 'units' },
  { key: 'publicBalance', label: 'Public balance', unit: 'modeled USD' },
  { key: 'commuteCount', label: 'Recorded commutes', unit: 'trips' },
];

export function readFutureLink(input) {
  let url;
  try {
    url = new URL(input.trim(), 'https://hbl.invalid');
  } catch {
    throw new Error('Enter a versioned City future link.');
  }
  if (!['http:', 'https:'].includes(url.protocol) ||
      url.pathname.replace(/\/$/, '') !== futurePath ||
      url.searchParams.getAll('plan').length !== 1) {
    throw new Error('Enter a City future link with exactly one plan recipe.');
  }
  return decodePlan(url.searchParams.get('plan'));
}

export function mergePlans(sourceA, sourceB) {
  const left = normalizePlan(sourceA);
  const right = normalizePlan(sourceB);
  for (const [key, label] of [
    ['version', 'plan versions'], ['modelVersion', 'model versions'], ['seed', 'seeds'], ['months', 'horizons'],
  ]) {
    if (left[key] !== right[key]) throw new Error('These source plans use different ' + label + '.');
  }

  const union = new Set([...left.policies, ...right.policies]);
  const decisions = new Map();
  for (const id of union) {
    const policy = policies.get(id);
    const key = policy.type + '/' + policy.districtId;
    if (decisions.has(key)) {
      throw new Error(`Competing choices for ${policy.type} in district ${policy.districtId}. Keep one policy for this decision.`);
    }
    decisions.set(key, id);
  }
  const merged = normalizePlan({ ...left, policies: [...union].sort() });
  const baseline = normalizePlan({ ...left, policies: [] });
  const shared = left.policies.filter(id => right.policies.includes(id));
  return { left, right, merged, baseline, shared };
}

export function runMerge(sourceA, sourceB) {
  const plans = mergePlans(sourceA, sourceB);
  const arms = Object.fromEntries(['baseline', 'left', 'right', 'merged'].map(key => {
    const recipe = plans[key];
    const { final } = runPlan(recipe);
    return [key, {
      final,
      cost: planCost(recipe),
      recipe,
      href: futureURL(recipe, final.month),
    }];
  }));
  // Shared policies appear in both source arms but only once in the merged
  // plan, so adding their separate effects would double-count them.
  const interactions = plans.shared.length ? null : Object.fromEntries(measures.map(({ key }) => {
    const values = ['baseline', 'left', 'right', 'merged'].map(arm => arms[arm].final[key]);
    const [baseline, left, right, merged] = values;
    return [key, values.every(Number.isFinite) ? merged - left - right + baseline : null];
  }));
  return { arms, shared: plans.shared, interactions };
}
