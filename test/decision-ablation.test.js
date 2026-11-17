import { test, expect } from 'bun:test';
import fixture from './fixtures/decision-ablation/representative.json';
import { normalizeDecisionInput } from '../world/decision/contracts.js';
import { executeDecisionExperiment } from '../world/decision/kernel.js';
import { housingModel as model, simulateHousingRun } from '../world/models/housing/index.js';
import { ablationChoices, createAblation, validateAblationResult } from '../world/decision/ablation.js';
const input = () => normalizeDecisionInput(fixture, model);
async function execute(expected) {
  const experiment = { ...expected, id: 'fresh' };
  const result = await executeDecisionExperiment({ experiment, model, simulateRun: simulateHousingRun });
  return { ...result, experiment: { ...experiment, status: result.status } };
}
test('one setting only, preserved source and inputs, matched deterministic execution', async () => {
  const source = input(), before = structuredClone(source);
  const expected = createAblation(source, 'plan', 'permitting_months', model, 'parent');
  expect(source).toEqual(before);
  expect(expected.seed).toBe(source.seed); expect(expected.runs).toBe(source.runs); expect(expected.years).toBe(source.years);
  const [control, variant] = expected.scenarios;
  expect(control.parameters).toEqual(source.scenarios[1].parameters);
  expect({ ...variant.parameters, permitting_months: control.parameters.permitting_months }).toEqual(control.parameters);
  expect(variant.uncertainty).toEqual(control.uncertainty);
  const a = await execute(expected), b = await execute(expected);
  expect(a.runs.map(r => [r.seed, r.metrics])).toEqual(b.runs.map(r => [r.seed, r.metrics]));
  expect(validateAblationResult(a, expected, model).pairs).toBe(3);
  expect(validateAblationResult(a, expected, model)).toEqual(validateAblationResult(b, expected, model));
});
test('coupled changes, missing parent, unknown setting and uncertainty are blocked', () => {
  for (const extra of [{ stressPresets: ['recession'] }, { timelineFork: {} }, { inheritsFrom: 'baseline' }, { uncertainty: { permitting_months: { type: 'fixed', value: 6 } } }]) {
    const source = input(); Object.assign(source.scenarios[1], extra);
    expect(ablationChoices(source, 'plan', model).find(c => c.id === 'permitting_months').blocked).toBeTruthy();
    expect(() => createAblation(source, 'plan', 'permitting_months', model, 'parent')).toThrow();
  }
  expect(() => createAblation(input(), 'plan', 'unknown', model, 'parent')).toThrow();
  expect(() => createAblation(input(), 'plan', 'permitting_months', model)).toThrow();
});
test('no effect for incomplete, failed, duplicate, mismatched or nonfinite evidence', async () => {
  const expected = createAblation(input(), 'plan', 'permitting_months', model, 'parent');
  const valid = await execute(expected);
  const mutations = [r => r.experiment.status = 'running', r => r.experiment.seed++, r => r.runs.pop(), r => r.runs[0].status = 'failed', r => r.runs[0].seed++, r => r.runs[0].metrics.housing_supply = null, r => r.runs[0].experimentId = 'other', r => r.runs[1] = r.runs[0]];
  for (const mutate of mutations) { const result = structuredClone(valid); mutate(result); expect(() => validateAblationResult(result, expected, model)).toThrow(); }
});
