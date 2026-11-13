import { expect, test } from 'bun:test';
import { validateState, VERSION } from '../world/city/contracts.js';
import {
  COMMUTE_OPTIONS,
  createQuestScenario,
  replayCommuteSample,
  runCommuteEnsemble,
} from '../world/living-city/quests.js';

test('five quests describe actual entities and observed problems in the authored city', () => {
  const scenario = createQuestScenario();
  expect(validateState(scenario.state)).toBe(true);
  expect(scenario.modelVersion).toBe(VERSION);
  expect(new Set(scenario.quests.map(quest => quest.type))).toEqual(new Set([
    'commute', 'housing', 'business', 'school', 'utility',
  ]));
  for (const { entity, evidence, provenance, objective } of scenario.quests) {
    const row = scenario.state[entity.collection].find(item => item.id === entity.id);
    expect(row.districtId).toBe(entity.districtId);
    expect(evidence.every(item => item.month === scenario.month && Number.isFinite(item.value))).toBe(true);
    expect(evidence[0].value).toBeGreaterThan(objective.target);
    expect(provenance.seed).toBe(scenario.seed);
  }

});

test('100 paired futures keep seeds distinct across samples and exactly replay both arms', () => {
  const ensemble = runCommuteEnsemble();
  expect(ensemble.samples).toHaveLength(100);
  expect(new Set(ensemble.samples.map(sample => sample.seed)).size).toBe(100);
  expect(ensemble.summary.paired + ensemble.summary.unpaired).toBe(100);
  expect(ensemble.summary.improved + ensemble.summary.unchanged + ensemble.summary.worsened)
    .toBe(ensemble.summary.paired);
  expect(ensemble.summary.improved).toBeGreaterThan(0);
  expect(ensemble.summary.meanBalanceDelta).toBeLessThan(0);
  const comparable = ensemble.samples.find(sample => sample.delta.commuteMinutes !== null);
  const missing = ensemble.samples.find(sample => sample.delta.commuteMinutes === null);
  expect(missing).toBeDefined();
  for (const sample of [comparable, missing]) {
    const replay = replayCommuteSample({ index: sample.index });
    expect(replay.delta).toEqual(sample.delta);
    expect(replay.shock).toEqual(sample.shock);
    for (const arm of ['baseline', 'intervention']) {
      const { state, trips, events, quests, ...compact } = replay[arm];
      expect(compact).toEqual(sample[arm]);
      expect(state.seed).toBe(sample.seed);
      expect(state.month).toBe(ensemble.startMonth + ensemble.months);
      expect(compact.participant.trip).toEqual(
        trips.find(row => row.personId === compact.participant.personId) ?? null,
      );
      expect(events.every(event => event.simulationTime > ensemble.startMonth)).toBe(true);
    }
    expect(replay.baseline.state.shocks).toEqual(replay.intervention.state.shocks);
    expect(replay.baseline.state.links.map(link => link.id)).toEqual(
      replay.intervention.state.links.map(link => link.id),
    );
  }
  const replay = replayCommuteSample({ index: comparable.index });
  expect(replay.intervention.events.some(event => event.eventType === 'PROJECT_COMPLETE' &&
    event.payload.type === 'transit')).toBe(true);
  const id = createQuestScenario().participant.trip.route[0];
  const before = replay.baseline.state.links.find(link => link.id === id);
  const after = replay.intervention.state.links.find(link => link.id === id);
  expect(after.capacity - before.capacity).toBe(ensemble.amount);
});

test('policy presets are validated and an unfinished project cannot improve link capacity', () => {
  const replay = replayCommuteSample({ seed: 30, amount: COMMUTE_OPTIONS[0].amount, months: 1, index: 0 });
  expect(replay.intervention.policyStage).toBe('APPROVED');
  expect(replay.delta.commuteMinutes).toBe(0);
  expect(replay.intervention.state.links).toEqual(replay.baseline.state.links);
  expect(() => runCommuteEnsemble({ samples: 101 })).toThrow(RangeError);
  expect(() => runCommuteEnsemble({ amount: 6 })).toThrow(RangeError);
  expect(() => runCommuteEnsemble({ months: 0 })).toThrow(RangeError);
  expect(() => replayCommuteSample({ index: -1 })).toThrow(RangeError);
});
