import { test, expect } from 'bun:test';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { DEFAULT_RECIPE } from '../world/future-machine/contracts.js';
import { initialForRecipe, normalizeReplay } from '../world/future-machine/data/index.js';
import { stateHash } from '../world/future-machine/data/core.js';
import { compareHistory } from '../world/future-machine/diff/index.js';

function pair(recipe) {
  const initial = initialForRecipe(recipe);
  function run(intervention) {
    const engine = createEngine(), steps = [];
    let state = intervention ? addIntervention(initial, intervention) : structuredClone(initial);
    for (let month = 0; month < recipe.months; month++) {
      const step = engine.step(state);
      steps.push(step);
      state = step.state;
    }
    return normalizeReplay(initial, { steps });
  }
  return { seed: recipe.seed, modelVersion: recipe.modelVersion,
    baseline: run(null), plan: run(recipe.intervention) };
}

test('seed-42 normalized histories and frame diffs have repeatable digests', async () => {
  const first = pair(DEFAULT_RECIPE), second = pair(DEFAULT_RECIPE);
  const diffs = compareHistory(first);
  expect(first.baseline).toHaveLength(121);
  expect(first.plan).toHaveLength(121);
  expect(first.baseline[0]).toEqual(first.plan[0]);
  const digests = {
    initial: await stateHash(first.baseline[0].state),
    baseline: await stateHash(first.baseline),
    plan: await stateHash(first.plan),
    diff: await stateHash(diffs),
  };
  expect(await stateHash(second.baseline)).toBe(digests.baseline);
  expect(await stateHash(second.plan)).toBe(digests.plan);
  expect(await stateHash(compareHistory(second))).toBe(digests.diff);
  expect(await stateHash(second.plan[0].state)).toBe(digests.initial);
  for (const snapshot of [...first.baseline, ...first.plan]) {
    expect(snapshot.state.seed).toBe(42);
    expect(Object.values(snapshot.metrics).every(value => value === null || Number.isFinite(value))).toBe(true);
  }
  const physical = diffs.find(frame => frame.physicalCount > 0);
  expect(physical.month).toBe(16);
  expect(physical.entities.filter(entity => entity.physical).map(({ collection, id, kind }) => ({ collection, id, kind })))
    .toEqual([{ collection: 'buildings', id: 'building-project-policy-1-0', kind: 'added' }]);
  expect(physical.metrics.housingUnits).toMatchObject({ baseline: 36, plan: 60, delta: 24 });
  expect(physical.metrics.capitalSpending).toMatchObject({ baseline: 0, plan: 1000000, delta: 1000000 });
  console.log(JSON.stringify({ recipe: DEFAULT_RECIPE, digests, firstPhysical: {
    month: physical.month, entity: 'building-project-policy-1-0',
    homes: physical.metrics.housingUnits, capitalSpending: physical.metrics.capitalSpending,
  } }));
}, 15000);

test('zero intervention has identical normalized arms and no diff at every month', async () => {
  const history = pair({ ...DEFAULT_RECIPE, intervention: null });
  expect(await stateHash(history.baseline)).toBe(await stateHash(history.plan));
  expect(compareHistory(history).every(frame => frame.physicalCount === 0 && frame.changedCount === 0
    && Object.values(frame.metrics).every(metric => metric.delta === 0))).toBe(true);
});
