import { test, expect } from 'bun:test';
import { scenarioParameterDiff } from '../world/decision/parameter-diff.js';
import { housingModel, createHousingScenarios, simulateHousingRun } from '../world/models/housing/index.js';

const recipe = () => ({ seed: 87, runs: 1, years: 1, scenarios: [
  { id: 'baseline', name: 'Baseline', kind: 'baseline', parameters: {} },
  { id: 'treatment', name: 'Intervention', kind: 'alternative', parameters: { permitting_months: 6 } },
] });
test('sparse defaults expose exactly the selected intervention without mutating shared assumptions', () => {
  const input = recipe(), original = structuredClone(input);
  const diff = scenarioParameterDiff(input, housingModel, 'treatment');
  expect(diff.rows).toHaveLength(housingModel.parameters.length);
  expect(diff.rows.filter(r => r.changed).map(r => r.id)).toEqual(['permitting_months']);
  expect(diff.seed).toBe(87);
  expect(input).toEqual(original);
  const baseline = Object.fromEntries(diff.rows.map(r => [r.id, r.before.value]));
  const treatment = Object.fromEntries(diff.rows.map(r => [r.id, r.after.value]));
  const run = parameters => simulateHousingRun({ parameters, seed: input.seed, years: input.years });
  expect(run(baseline)).toEqual(run(baseline));
  expect(run(treatment)).toEqual(run(treatment));
});
test('uncertainty, presets, forks and inherited overrides remain inspectable', () => {
  const input = recipe();
  input.scenarios[0].uncertainty = { migration: { type: 'uniform', min: 0, max: .02 } };
  input.scenarios[1] = { id: 'treatment', name: 'Child', kind: 'alternative', inheritsFrom: 'baseline', overrides: {
    parameters: { permitting_months: 6 }, uncertainty: { migration: { max: .03, min: 0, type: 'uniform' } },
    stressPresets: ['recession'], timelineFork: { month: 12, operations: [] },
  } };
  const diff = scenarioParameterDiff(input, housingModel, 'treatment');
  expect(diff.rows.filter(r => r.changed).map(r => r.id).sort()).toEqual(['migration','permitting_months']);
  expect(diff.settings.filter(r => r.changed).map(r => r.id).sort()).toEqual(['stressPresets','timelineFork']);
});
test('default plans preserve shared distributions and object key order is immaterial', () => {
  const input = { scenarios: createHousingScenarios() };
  const diff = scenarioParameterDiff(input, housingModel, 'plan-a');
  expect(diff.rows.filter(r => r.changed).map(r => r.id).sort()).toEqual(['permitting_months','subsidy_amount','transit_share','voucher_funding','zoning_density']);
  expect(diff.seed).toBe(42);
  const row = input.scenarios[1].uncertainty.migration;
  input.scenarios[1].uncertainty.migration = { max: row.max, mode: row.mode, min: row.min, type: row.type };
  expect(scenarioParameterDiff(input, housingModel, 'plan-a').rows.find(r => r.id === 'migration').changed).toBe(false);
});
test('missing baseline fails explicitly', () => {
  expect(() => scenarioParameterDiff({scenarios: []}, housingModel, 'missing')).toThrow('baseline');
});
