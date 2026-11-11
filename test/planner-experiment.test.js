import { expect, test } from 'bun:test';
import { COMMUTE_OPTIONS, QUEST_SCENARIO_VERSION, replayCommuteSample } from '../world/living-city/quests.js';
import { decodeChallenge } from '../world/living-city/recipe.js';
import { predictCommute, runPlannerExperiment } from '../world/civilization/research/experiment.js';

test('the simplified planner keeps starting route demand fixed and predicts an eligible capacity change', () => {
  const scenario = {
    participant: { trip: { route: ['outbound', 'transfer'], originId: 'a' } },
    state: { links: [
      { id: 'outbound', from: 'a', mode: 'transit', flow: 4, capacity: 2, freeTime: 5 },
      { id: 'transfer', from: 'b', mode: 'transit', flow: 3, capacity: 2, freeTime: 5 },
    ] },
  };
  const snapshot = structuredClone(scenario);
  expect(predictCommute(scenario, 4)).toMatchObject({ baseline: 25, intervention: 15, delta: -10 });
  expect(scenario).toEqual(snapshot);
  expect(() => runPlannerExperiment({ seed: -1 })).toThrow(RangeError);
  expect(() => runPlannerExperiment({ amount: 999 })).toThrow(RangeError);
});

test('100 paired City outcomes and an exact comparable replay are returned with the forecast', () => {
  const result = runPlannerExperiment({ seed: 2911, amount: 8 });
  expect(result.samples).toBe(100);
  expect(result.summary.paired + result.summary.unpaired).toBe(100);
  expect(result.summary.paired).toBeGreaterThan(0);
  expect(result.forecast.evidence.some(link => link.expands)).toBe(true);
  const recipe = decodeChallenge(result.challenge, {
    version: `${QUEST_SCENARIO_VERSION}+${result.cityVersion}`, samples: result.samples, options: COMMUTE_OPTIONS,
  });
  expect(recipe).toMatchObject({ seed: result.seed, amount: result.amount });
  const replay = replayCommuteSample(recipe);
  expect(replay.delta.commuteMinutes).toBeGreaterThanOrEqual(result.summary.minDelta);
  expect(replay.delta.commuteMinutes).toBeLessThanOrEqual(result.summary.maxDelta);
  expect(runPlannerExperiment({ seed: 2911, amount: 8 })).toEqual(result);
}, 30000);
