import { test, expect } from 'bun:test';
import { addIntervention, createEngine } from '../world/city/engine.js';
import { DEFAULT_RECIPE, METRIC_UNITS } from '../world/future-machine/contracts.js';
import { initialForRecipe, normalizeReplay } from '../world/future-machine/data/index.js';
import { freeze, stateHash } from '../world/future-machine/data/core.js';
import { compareHistory } from '../world/future-machine/diff/index.js';

function run(initial, intervention) {
  const engine = createEngine(), steps = [];
  let state = intervention ? addIntervention(initial, intervention) : structuredClone(initial);
  for (let month = 1; month <= 120; month++) {
    const step = engine.step(state);
    steps.push(step);
    state = step.state;
  }
  return normalizeReplay(initial, { steps });
}

test('seed-42 paired state and diff digests reproduce with real physical evidence', async () => {
  const initial = freeze(initialForRecipe()), initialHash = await stateHash(initial);
  const pair = () => ({ seed: initial.seed, modelVersion: initial.version,
    baseline: run(initial, null), plan: run(initial, DEFAULT_RECIPE.intervention) });
  const first = pair(), second = pair();
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
  expect(await stateHash(second.plan[0].state)).toBe(digests.initial);
  expect(await stateHash(first)).toBe(await stateHash(second));
  expect(await stateHash(diffs)).toBe(await stateHash(compareHistory(second)));
  expect(await stateHash(initial)).toBe(initialHash);
  for (const arm of [first.baseline, first.plan]) {
    expect(arm.every(snapshot => snapshot.state.seed === 42)).toBe(true);
    expect(arm.every(snapshot => Object.keys(METRIC_UNITS).every(key =>
      snapshot.metrics[key] === null || Number.isFinite(snapshot.metrics[key])))).toBe(true);
  }
  for (const snapshot of [...first.baseline, ...first.plan]) {
    expect(snapshot.state.seed).toBe(42);
    expect(Object.values(snapshot.metrics).every(value => value === null || Number.isFinite(value))).toBe(true);
  }
  const physical = diffs.find(diff => diff.physicalCount > 0);
  expect(physical.month).toBe(16);
  expect(physical.entities.filter(entity => entity.physical).map(entity =>
    [entity.collection, entity.id, entity.kind])).toEqual([
    ['buildings', 'building-project-policy-1-0', 'added'],
  ]);
  expect(physical.metrics.housingUnits).toMatchObject({ baseline: 36, plan: 60, delta: 24 });
  expect(physical.metrics.capitalSpending).toMatchObject({ baseline: 0, plan: 1000000, delta: 1000000 });
  const completion = first.plan[16].events.find(event => event.eventType === 'PROJECT_COMPLETE');
  expect(completion).toMatchObject({ id: '16-0', simulationTime: 16,
    payload: { projectId: 'project-policy-1-0', units: 24 } });
  console.log(JSON.stringify({ recipe: DEFAULT_RECIPE, initialHash, digests,
    stateDigest: await stateHash(first), diffDigest: await stateHash(diffs),
    firstPhysical: { month: physical.month, entities: physical.entities.filter(entity => entity.physical),
      housingUnits: physical.metrics.housingUnits, capitalSpending: physical.metrics.capitalSpending },
    completion }));
}, 15000);

test('zero intervention produces identical full histories and zero deltas at every month', async () => {
  const initial = freeze(initialForRecipe({ ...DEFAULT_RECIPE, intervention: null }));
  const baseline = run(initial, null), plan = run(initial, null);
  expect(await stateHash(baseline)).toBe(await stateHash(plan));
  const diffs = compareHistory({ seed: initial.seed, modelVersion: initial.version, baseline, plan });
  expect(diffs).toHaveLength(121);
  expect(diffs.every(diff => diff.available && diff.changedCount === 0 && diff.physicalCount === 0 &&
    Object.values(diff.metrics).every(metric => metric.delta === 0))).toBe(true);
});
