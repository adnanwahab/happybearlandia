import { test, expect } from 'bun:test';
import { POLICY_CHOICES, policyChoices, policyId } from '../world/future-machine/ui/policies.js';
import { DEFAULT_RECIPE } from '../world/future-machine/contracts.js';
import { initialForRecipe, normalizeReplay, validateRecipe } from '../world/future-machine/data/index.js';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { stateHash } from '../world/future-machine/data/core.js';
import { encodeRecipe, decodeRecipe } from '../world/future-machine/share/index.js';

test('first policy choices run existing matched City rules with recorded outcomes and provenance', async () => {
  const initial = initialForRecipe(), originalHash = await stateHash(initial);
  const run = intervention => {
    let state = intervention ? addIntervention(initial, intervention) : structuredClone(initial);
    const engine = createEngine(), steps = [];
    for (let month = 0; month < 120; month++) { const step = engine.step(state); steps.push(step); state = step.state; }
    return normalizeReplay(initial, { steps });
  };
  const baseline = run(null);
  for (const choice of POLICY_CHOICES) {
    const recipe = validateRecipe({ ...DEFAULT_RECIPE, intervention: choice.intervention });
    expect(decodeRecipe(encodeRecipe(recipe))).toEqual(recipe);
    const history = run(recipe.intervention);
    expect(history[0]).toEqual(baseline[0]);
    expect(history).toEqual(run(recipe.intervention));
    expect(history[120].metrics.housingUnits - baseline[120].metrics.housingUnits).toBe(choice.intervention?.amount ?? 0);
    expect(history[120].metrics.capitalSpending).toBe(choice.intervention?.cost ?? 0);
    expect(history[120].state.seed).toBe(baseline[120].state.seed);
    if (choice.intervention) {
      const completion = history.flatMap(frame => frame.events).find(event => event.eventType === 'PROJECT_COMPLETE');
      expect(completion.payload.units).toBe(choice.intervention.amount);
      expect(completion.modelVersion).toBe(DEFAULT_RECIPE.modelVersion);
    } else expect(history).toEqual(baseline);
  }
  expect(await stateHash(initial)).toBe(originalHash);
});

test('loaded policies retain exact inputs and returning to presets does not mutate them', () => {
  const custom = { ...DEFAULT_RECIPE.intervention, amount: 18, cost: 750000 };
  const choices = policyChoices(custom);
  expect(policyId(custom)).toBe('saved');
  expect(choices[0].intervention).toEqual(custom);
  choices[0].intervention.amount = 99;
  expect(custom.amount).toBe(18);
  expect(policyId({ ...DEFAULT_RECIPE.intervention })).toBe('housing');
  expect(policyId(null)).toBe('baseline');
  expect(policyChoices(null)).toHaveLength(3);
  expect(policyChoices(custom)[0].description).toContain('monthly City');
});
