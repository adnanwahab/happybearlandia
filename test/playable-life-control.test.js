import { test, expect } from 'bun:test';
import { createPopulationRuntime } from '../world/population/runtime.js';
import { residentSummary, submitLifeAction, lifeComparison } from '../world/house/playable-life.js';

const create = () => createPopulationRuntime({ config: { population: 8, householdSize: 4, seed: 42 }, stepMinutes: 60 });
test('exact checkpoint no-action pairs replay identically and a plant changes savings', async () => {
  const runtimes = [create(), create(), create()];
  try {
    await Promise.all(runtimes.map(r => r.ready));
    const checkpoint = await runtimes[0].exportCheckpoint();
    await Promise.all(runtimes.slice(1).map(r => r.restoreCheckpoint(checkpoint)));
    const { id: entityId, householdId } = runtimes[0].getSnapshot().visibleAgents[0];
    await submitLifeAction(runtimes[2], { householdId, entityId }, 'purchase');
    const outcomes = [];
    for (const r of runtimes) {
      for (let day = 0; day < 31; day++) {
        expect((await r.observeHousehold({ householdId, minutes: 1440 })).status).toBe('completed');
      }
      outcomes.push(residentSummary(await r.inspectPerson(entityId), await r.inspectHousehold(householdId)));
    }
    expect(outcomes[0]).toEqual(outcomes[1]);
    expect(outcomes[2].savings).not.toBe(outcomes[0].savings);
    expect(runtimes.map(r => r.getSnapshot().config.seed)).toEqual([42, 42, 42]);
    console.log('Seed 42 savings: with action', outcomes[2].savings, 'matched control', outcomes[0].savings);
  } finally { runtimes.forEach(r => r.destroy()); }
}, 120000);

test('differences require compatible arms and preserve missing observations', () => {
  const arm = { seed: 42, modelVersion: 'test.v1', runId: 'start', entityId: 'p0', startTick: 0, endTick: 2976 };
  const report = { arm, after: { needs: { energy: 30, hunger: null }, savings: 50 },
    matchedControl: { ...arm, after: { needs: { energy: 20, hunger: 10 }, savings: 75 } } };
  expect(lifeComparison(report)).toEqual({ needs: { energy: 10, hunger: null }, savings: -25 });
  expect(lifeComparison({ ...report, matchedControl: undefined })).toBeNull();
  for (const key of Object.keys(arm)) {
    expect(lifeComparison({ ...report, matchedControl: { ...report.matchedControl, [key]: 'mismatch' } })).toBeNull();
  }
});
