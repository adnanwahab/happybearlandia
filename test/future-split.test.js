import { expect, test } from 'bun:test';
import { addIntervention, createEngine } from '../world/city/engine.js';
import { POLICY_CATALOG } from '../world/invention/model.js';
import { createQuestScenario } from '../world/living-city/quests.js';
import {
  compareEntities, decodeRecipe, DEFAULT_RECIPE, encodeRecipe,
  normalizeRecipe, runFutureSplit,
} from '../world/future-split/model.js';

test('the paired replay is deterministic and begins at the identical Riverside checkpoint', () => {
  const run = runFutureSplit();
  expect(runFutureSplit(decodeRecipe(encodeRecipe(run.recipe)))).toEqual(run);
  expect(run.frames.map(frame => frame.month)).toEqual(Array.from({ length: 13 }, (_, i) => i + 2));
  expect(run.provenance).toMatchObject({ startMonth: 2, seed: run.recipe.seed, modelVersion: run.recipe.modelVersion });
  expect(run.frames[0].intervention).toEqual(run.frames[0].baseline);
  expect(run.frames[0].changes).toEqual([]);
  expect(run.frames[1].changes).toEqual([]);
  expect(run.frames[1].baseline.metrics).toEqual(run.frames[1].intervention.metrics);
});

test('fiscal divergence, project appearance, and route changes occur in the City engine months', () => {
  const run = runFutureSplit();
  const start = createQuestScenario({ seed: run.recipe.seed });
  const selectedPolicy = POLICY_CATALOG.find(policy => policy.id === run.recipe.policyId);
  const engine = createEngine();
  let left = start.state;
  let right = addIntervention(start.state, selectedPolicy);
  let firstCapitalMonth;
  let firstProjectMonth;
  let firstRouteMonth;
  let capital = 0;

  for (const frame of run.frames.slice(1)) {
    const leftResult = engine.step(left);
    const rightResult = engine.step(right);
    left = leftResult.state;
    right = rightResult.state;
    capital += right.systems.finance.capitalExpense;

    if (capital > 0) firstCapitalMonth ??= frame.month;
    if (right.projects.length) firstProjectMonth ??= frame.month;
    const baselineLink = left.links.find(link => link.id === 'transit-d1-d0');
    const interventionLink = right.links.find(link => link.id === baselineLink.id);
    if (baselineLink.capacity !== interventionLink.capacity) firstRouteMonth ??= frame.month;
    const visibleLink = frame.intervention.entities.find(entity => entity.modelId === interventionLink.id);
    expect(visibleLink.fields).toMatchObject({
      capacity: interventionLink.capacity, flow: interventionLink.flow,
      freeTimeMinutes: interventionLink.freeTime, travelTimeMinutes: interventionLink.travelTime,
    });
    const trips = rightResult.trips;
    expect(frame.intervention.metrics).toMatchObject({
      capitalSpending: capital, publicBalance: right.finance.balance, commuteCount: trips.length,
      meanCommuteMinutes: trips.reduce((sum, trip) => sum + trip.experiencedMinutes, 0) / trips.length,
    });
    expect(frame.intervention.events).toEqual(rightResult.events);
  }

  expect(run.firstDivergenceMonth).toBe(firstCapitalMonth);
  expect(run.frames.find(frame => frame.changes.some(change => change.kind === 'project')).month).toBe(firstProjectMonth);
  const firstRoute = run.frames.find(frame => frame.changes.some(change => change.id === 'route:transit-d1-d0'));
  expect(firstRoute.month).toBe(firstRouteMonth);
  expect(firstRoute.changes.find(change => change.id === 'route:transit-d1-d0')).toMatchObject({
    status: 'modified', before: { fields: { capacity: 1 } }, after: { fields: { capacity: 9 } },
  });
  expect(run.frames.at(-1).baseline.metrics.capitalSpending).toBe(0);
});

test('an intervention with no observed outcome within the horizon and a no-policy replay have no divergence', () => {
  expect(runFutureSplit({ months: 1 }).firstDivergenceMonth).toBeNull();
  const run = runFutureSplit({ policyId: '', seed: 100, months: 24 });
  expect(run.firstDivergenceMonth).toBeNull();
  for (const frame of run.frames) {
    expect(frame.baseline).toEqual(frame.intervention);
    expect(frame.changes).toEqual([]);
  }
});

test('policy-local project IDs do not collide across recipes and stalled construction creates no building', () => {
  const housing = runFutureSplit({ policyId: 'housing-d1-6', months: 36 }).frames.at(-1);
  const transit = runFutureSplit().frames.at(-1);
  const housingProject = housing.changes.find(change => change.kind === 'project').after;
  const transitProject = transit.changes.find(change => change.kind === 'project').after;
  expect(housingProject.modelId).toBe(transitProject.modelId);
  expect(housingProject.id).not.toBe(transitProject.id);
  expect(housingProject.fields.stage).toBe('construction');
  expect(housing.changes.some(change => change.kind === 'building' && change.status === 'added')).toBe(false);
  expect(housing.intervention.metrics.housingUnits).toBe(housing.baseline.metrics.housingUnits);
});

test('entity comparison reports added, removed and exact field changes without cross-kind matches', () => {
  const building = (id, fields) => ({ id: `building:${id}`, kind: 'building', modelId: id, fields });
  const a = building('retained', { floors: 1, housingUnits: 2 });
  const b = building('retained', { floors: 1, housingUnits: 3 });
  const retired = building('a', { floors: 3 });
  const added = { id: 'project:a', kind: 'project', modelId: 'a', fields: { stage: 'permit' } };
  expect(compareEntities([a, retired], [b, added])).toEqual([
    { id: a.id, kind: 'building', status: 'modified', before: a, after: b, fields: ['housingUnits'] },
    { id: retired.id, kind: 'building', status: 'removed', before: retired, after: null, fields: ['floors'] },
    { id: added.id, kind: 'project', status: 'added', before: null, after: added, fields: ['stage'] },
  ]);
});

test('recipes reject unsupported models, invalid settings and malformed links', () => {
  expect(normalizeRecipe()).toEqual(DEFAULT_RECIPE);
  expect(() => normalizeRecipe({ modelVersion: 'future-model' })).toThrow('unsupported version');
  expect(() => normalizeRecipe({ scenarioVersion: 'different-source' })).toThrow('unsupported version');
  expect(() => normalizeRecipe({ months: 37 })).toThrow('1 to 36 months');
  expect(() => normalizeRecipe({ seed: -1 })).toThrow('whole-number seed');
  expect(() => normalizeRecipe({ policyId: 'unlisted' })).toThrow('supported City policy');
  expect(() => decodeRecipe('{}')).toThrow('missing its version');
  expect(() => decodeRecipe('not JSON')).toThrow('invalid');
});
