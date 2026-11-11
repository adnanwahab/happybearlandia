import { VERSION } from '../city/contracts.js';
import { addIntervention, cityMetrics, createEngine } from '../city/engine.js';
import { createQuestScenario, QUEST_SCENARIO_VERSION } from '../living-city/quests.js';

export const PLAN_VERSION = 'riverside-policy-plan.v1';
export const PLAN_MODEL_VERSION = VERSION;
export const PLAN_START_MONTH = 2;
export const MAX_POLICIES = 9;
export const PLAN_DEFAULTS = Object.freeze({ seed: 2911, months: 12, policies: Object.freeze([]) });

const districts = [['d0', 'Center'], ['d1', 'Riverside'], ['d2', 'Uptown']];
const options = [
  ['transit', 'Transit capacity', 4, 80000],
  ['transit', 'Transit capacity', 8, 160000],
  ['transit', 'Transit capacity', 12, 240000],
  ['housing', 'Public housing units', 3, 420000],
  ['housing', 'Public housing units', 6, 840000],
  ['upzone', 'Additional zoning capacity', 12, 30000],
];
export const POLICY_CATALOG = Object.freeze(districts.flatMap(([districtId, district]) =>
  options.map(([type, label, amount, cost]) => Object.freeze({
    id: `${type}-${districtId}-${amount}`, label: `${district} · ${label} +${amount}`,
    type, districtId, amount, cost,
  })),
));
const byId = new Map(POLICY_CATALOG.map(policy => [policy.id, policy]));
const engine = createEngine();

export function normalizePlan(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Choose a valid City plan.');
  if ((input.version !== undefined && input.version !== PLAN_VERSION) ||
      (input.modelVersion !== undefined && input.modelVersion !== VERSION)) {
    throw new Error('This City plan uses an unsupported version.');
  }
  const { seed = PLAN_DEFAULTS.seed, months = PLAN_DEFAULTS.months, policies = PLAN_DEFAULTS.policies } = input;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Choose a whole-number seed from 0 to 4294967295.');
  if (!Number.isInteger(months) || months < 1 || months > 36) throw new Error('Choose a horizon of 1 to 36 months.');
  if (!Array.isArray(policies) || policies.length > MAX_POLICIES) throw new Error('Choose up to 9 compatible policy options.');
  const scopes = new Set();
  for (const id of policies) {
    const policy = byId.get(id);
    if (!policy) throw new Error('The plan contains an unsupported policy option.');
    const scope = policy.type + '/' + policy.districtId;
    if (scopes.has(scope)) throw new Error('Choose only one option of each policy type per district.');
    scopes.add(scope);
  }
  return { version: PLAN_VERSION, modelVersion: VERSION, seed, months, policies: [...policies].sort() };
}

export function planCost(input) {
  return normalizePlan(input).policies.reduce((cost, id) => cost + byId.get(id).cost, 0);
}

export function encodePlan(input) {
  return JSON.stringify(normalizePlan(input));
}

export function decodePlan(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 1400) throw new Error('This City plan link is invalid.');
  let input;
  try {
    input = JSON.parse(encoded);
  } catch {
    throw new Error('This City plan link is invalid.');
  }
  if (!input || !['version', 'modelVersion', 'seed', 'months', 'policies'].every(key => Object.hasOwn(input, key))) {
    throw new Error('This City plan link is missing its version or settings.');
  }
  return normalizePlan(input);
}

export function futureURL(input, month) {
  const recipe = normalizePlan(input);
  const query = new URLSearchParams({ plan: encodePlan(recipe) });
  if (month !== undefined) {
    if (!Number.isInteger(month) || month < PLAN_START_MONTH || month > PLAN_START_MONTH + recipe.months) {
      throw new Error('Choose a month within this plan’s horizon.');
    }
    query.set('month', month);
  }
  return '/world/invention/future/?' + query;
}

function meanCommute(trips) {
  return trips.length ? trips.reduce((sum, trip) => sum + trip.experiencedMinutes, 0) / trips.length : null;
}

function summarize({ state, trips, events }, policies, includeDistricts) {
  const { balance, meanRent, housingUnits, unhoused, households, employed, completedProjects } = cityMetrics(state);
  const laborForce = state.workers.filter(worker => worker.available);
  const unemployed = laborForce.filter(worker => !worker.jobId).length;
  return {
    month: state.month,
    meanCommuteMinutes: meanCommute(trips), commuteCount: trips.length,
    unemploymentRate: laborForce.length ? unemployed / laborForce.length : null,
    laborForce: laborForce.length, unemployed, employed, households, housingUnits, unhoused, meanRent,
    publicBalance: balance, completedProjects, events,
    policyStages: policies.map((id, index) => ({ id, stage: state.policies[index]?.stage ?? null })),
    ...(includeDistricts && {
      districts: state.districts.map(({ id, name }) => {
        const localTrips = trips.filter(trip => trip.originId === id);
        const units = state.units.filter(unit => unit.districtId === id);
        return {
          id, name, commuteCount: localTrips.length, meanCommuteMinutes: meanCommute(localTrips),
          housingUnits: units.length,
          meanRent: units.length ? units.reduce((sum, unit) => sum + unit.rent, 0) / units.length : null,
          unhoused: state.households.filter(household => household.districtId === id && !household.unitId).length,
        };
      }),
    }),
  };
}

export function runPlan(input, { retainMonths = false, stopWhen } = {}) {
  const recipe = normalizePlan(input);
  const scenario = createQuestScenario({ seed: recipe.seed });
  const start = summarize(scenario, [], retainMonths);
  let state = scenario.state;
  for (const id of recipe.policies) state = addIntervention(state, byId.get(id));

  let final = start;
  let stopped = false;
  const series = retainMonths ? [start] : null;
  for (let i = 0; i < recipe.months; i++) {
    const step = engine.step(state);
    state = step.state;
    if (series || stopWhen || i === recipe.months - 1) {
      final = summarize(step, recipe.policies, retainMonths);
      if (series) series.push(final);
      if (stopWhen?.(final)) {
        stopped = true;
        break;
      }
    }
  }
  return { recipe, start, final, series, stopped, scenarioVersion: QUEST_SCENARIO_VERSION };
}
