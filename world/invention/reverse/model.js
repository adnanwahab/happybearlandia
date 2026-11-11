import { paretoCandidates } from '../../decision/optimization.js';
import { normalizePlan, planCost, PLAN_DEFAULTS, POLICY_CATALOG, runPlan } from '../model.js';

export const REVERSE_VERSION = 'reverse-simulator.v1';
export const REVERSE_DEFAULTS = Object.freeze({ targetReductionPercent: 25, budget: 500_000, candidateLimit: 128 });
export const REVERSE_SEARCH_LIMITS = Object.freeze([128, 1_024, 4_096]);
export const REVERSE_MAX_POLICIES = 4;
const catalog = new Map(POLICY_CATALOG.map(policy => [policy.id, policy]));

function bounded(value, min, max, name, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`Choose ${name} from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`);
  }
  return value;
}

export function normalizeReverseGoal(input = {}) {
  if (input.version !== undefined && input.version !== REVERSE_VERSION) throw new Error('Unsupported goal version.');
  const { targetReductionPercent, budget, candidateLimit } = { ...REVERSE_DEFAULTS, ...input };
  const baseline = normalizePlan({
    seed: input.seed ?? PLAN_DEFAULTS.seed, months: input.months ?? PLAN_DEFAULTS.months, policies: [],
  });
  const requested = input.allowedPolicies ?? [...catalog.keys()];
  if (!Array.isArray(requested) || requested.length > catalog.size ||
      new Set(requested).size !== requested.length || requested.some(id => !catalog.has(id))) {
    throw new Error('Choose supported policies from the catalog.');
  }
  if (!REVERSE_SEARCH_LIMITS.includes(candidateLimit)) throw new Error('Choose an available search size.');
  return {
    version: REVERSE_VERSION, baseline, candidateLimit,
    targetReductionPercent: bounded(targetReductionPercent, 0, 100, 'a commute reduction percentage'),
    budget: bounded(budget, 0, 1e9, 'a whole-dollar maximum budget', true),
    allowedPolicies: [...catalog.keys()].filter(id => requested.includes(id)),
  };
}

function* subsets(ids, length, index = 0, chosen = []) {
  if (length === 0) {
    yield chosen;
    return;
  }
  for (let i = index; i <= ids.length - length; i++) {
    yield* subsets(ids, length - 1, i + 1, [...chosen, ids[i]]);
  }
}

export function buildReverseSearch(input) {
  const goal = normalizeReverseGoal(input);
  const affordable = [];
  let outsideBudget = 0;
  for (let count = 1; count <= Math.min(REVERSE_MAX_POLICIES, goal.allowedPolicies.length); count++) {
    for (const policies of subsets(goal.allowedPolicies, count)) {
      const groups = policies.map(id => {
        const { type, districtId } = catalog.get(id);
        return `${type}/${districtId}`;
      });
      if (new Set(groups).size !== groups.length) continue;
      const recipe = normalizePlan({ ...goal.baseline, policies });
      const cost = planCost(recipe);
      if (cost > goal.budget) outsideBudget++;
      else affordable.push({ recipe, cost });
    }
  }
  // Budget-first admission keeps the affordable end of a bounded search available.
  affordable.sort((a, b) => a.cost - b.cost || a.recipe.policies.length - b.recipe.policies.length);
  return {
    goal, candidates: affordable.slice(0, goal.candidateLimit),
    outsideBudget, omitted: Math.max(0, affordable.length - goal.candidateLimit),
  };
}

function hasCommute(metric) {
  return Number.isFinite(metric.meanCommuteMinutes) && metric.meanCommuteMinutes >= 0 && metric.commuteCount > 0;
}

function evaluate({ recipe, cost }, baseline, goal) {
  const { final } = runPlan(recipe);
  const reduction = hasCommute(final)
    ? 100 * (baseline.meanCommuteMinutes - final.meanCommuteMinutes) / baseline.meanCommuteMinutes
    : null;
  return { recipe, cost, final, reduction, feasible: reduction !== null && reduction + 1e-9 >= goal.targetReductionPercent };
}

export function reverseFrontier(rows) {
  const measured = rows.filter(row => row.reduction !== null);
  const objectives = ['cost', 'commute', 'unhoused'].map(metricId => ({ metricId, direction: 'minimize' }));
  const source = measured.map((row, index) => ({
    id: index,
    feasible: true,
    aggregates: {
      metrics: {
        cost: { mean: row.cost },
        commute: { mean: row.final.meanCommuteMinutes },
        unhoused: { mean: row.final.unhoused },
      },
    },
  }));
  return paretoCandidates(source, objectives).map(index => measured[index]).sort((a, b) =>
    a.cost - b.cost || b.reduction - a.reduction || a.final.unhoused - b.final.unhoused);
}

export function runReverseSearch(input, onProgress = () => {}) {
  const { goal, candidates, outsideBudget, omitted } = buildReverseSearch(input);
  onProgress({ completed: 0, total: candidates.length, outsideBudget, omitted });
  const { final: baseline } = runPlan(goal.baseline);
  const report = { goal, baseline, planned: candidates.length, outsideBudget, omitted };
  if (!hasCommute(baseline) || baseline.meanCommuteMinutes === 0) {
    return { ...report, state: 'baseline-unavailable', completed: 0, missing: 0, feasibleCount: 0, frontier: [] };
  }

  const baselineResult = {
    recipe: goal.baseline, cost: 0, final: baseline, reduction: 0, feasible: goal.targetReductionPercent === 0,
  };
  const evaluated = [baselineResult];
  for (const candidate of candidates) {
    evaluated.push(evaluate(candidate, baseline, goal));
    onProgress({ completed: evaluated.length - 1, total: candidates.length, outsideBudget, omitted });
  }
  const feasible = evaluated.filter(row => row.feasible);
  const missing = evaluated.filter(row => row.reduction === null).length;
  return {
    ...report,
    state: feasible.length ? 'feasible' : missing === candidates.length && candidates.length > 0 ? 'unmeasured' : 'unmet',
    completed: candidates.length,
    missing,
    feasibleCount: feasible.length,
    frontier: reverseFrontier(feasible.length ? feasible : evaluated),
  };
}
