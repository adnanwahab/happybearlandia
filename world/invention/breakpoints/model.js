import { runPlan } from '../model.js';

export const BREAKPOINT_VERSION = 'city-breakpoint.v1';

export const metrics = Object.freeze({
  unemploymentRate: { label: 'Unemployment rate', unit: '%', min: 0, max: 100, scale: 100 },
  meanCommuteMinutes: { label: 'Mean commute time', unit: 'minutes', min: 0 },
  unhoused: { label: 'Unhoused households', unit: 'households', min: 0, integer: true },
  meanRent: { label: 'Mean rent', unit: 'modeled USD per month', min: 0 },
  housingUnits: { label: 'Housing units', unit: 'units', min: 0, integer: true },
  publicBalance: { label: 'City balance', unit: 'modeled USD' },
});

const operators = new Map([
  ['gt', (value, target) => value > target],
  ['gte', (value, target) => value >= target],
  ['lt', (value, target) => value < target],
  ['lte', (value, target) => value <= target],
]);

export function normalizeBreakpoint(input) {
  const { metric, operator, threshold } = input ?? {};
  const definition = Object.hasOwn(metrics, metric) ? metrics[metric] : null;
  if (!definition) throw new Error('Choose a supported metric.');
  if (!operators.has(operator)) throw new Error('Choose a supported comparison.');
  if (!Number.isFinite(threshold) || (definition.integer && !Number.isInteger(threshold))) {
    throw new Error(definition.integer ? 'Enter a whole-number threshold.' : 'Enter a numeric threshold.');
  }
  if (threshold < (definition.min ?? -Infinity) || threshold > (definition.max ?? Infinity)) {
    throw new Error(`Enter a threshold within the range for ${definition.label.toLowerCase()}.`);
  }
  return { metric, operator, threshold };
}

function valueAt(row, metric) {
  const value = row?.[metric];
  if (!Number.isFinite(value)) return null;
  return value * (metrics[metric].scale ?? 1);
}

export function runBreakpoint(plan, input) {
  const rule = normalizeBreakpoint(input);
  const { metric, operator, threshold } = rule;
  const compare = operators.get(operator);
  let hit = null;
  let missing = 0;
  let tested = 0;
  let previousStep;
  const run = runPlan(plan, {
    stopWhen(row) {
      const value = valueAt(row, metric);
      if (value === null) {
        missing++;
        previousStep = row;
        return false;
      }
      tested++;
      if (!compare(value, threshold)) {
        previousStep = row;
        return false;
      }
      hit = { month: row.month, value, events: row.events, policies: row.policyStages };
      return true;
    },
  });

  const previous = hit ? (previousStep ?? run.start) : null;
  return {
    rule,
    recipe: run.recipe,
    scenarioVersion: run.scenarioVersion,
    startMonth: run.start.month,
    month: run.final.month,
    value: valueAt(run.final, metric),
    previous: previous ? { month: previous.month, value: valueAt(previous, metric) } : null,
    hit,
    tested,
    missing,
  };
}
