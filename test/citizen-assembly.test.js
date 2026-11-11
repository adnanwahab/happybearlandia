import { expect, test } from 'bun:test';
import { runPlan } from '../world/invention/model.js';
import { ASSEMBLY_BUDGET, ASSEMBLY_VERSION, deliberate } from '../world/learning/assembly.js';

const baseline = runPlan({ seed: 2911, months: 12 }, { retainMonths: true });
const riverside = baseline.start.districts.find(row => row.id === 'd1');
const commute = {
  id: 'sensor-commute-d1-m2', sensorId: 'sensor-commute-d1', districtId: riverside.id,
  metric: 'meanCommuteMinutes', month: baseline.start.month,
  value: Math.round(riverside.meanCommuteMinutes), unit: 'minutes', uncertainty: { kind: 'rounding-bound', resolution: 1, lower: 29.5, upper: 30.5 },
  provenance: { seed: baseline.recipe.seed, modelVersion: baseline.recipe.modelVersion },
};
const position = (result, id) => result.decision.votes.find(vote => vote.id === id);

test('approval preserves the baseline recipe, budget, and exact district evidence', () => {
  const input = {
    baseline, policyId: 'transit-d1-4', visitorVote: 'support',
    observations: [
      { ...commute, id: 'older', month: 1, value: 12 },
      { ...commute, id: 'wrong-district', districtId: 'd0', value: 8 },
      commute,
      { ...commute, id: 'future', month: 3, value: 4 },
    ],
  };
  const approved = deliberate(input);
  expect(approved).toEqual(deliberate(input));
  expect(approved.plan).toEqual({ ...baseline.recipe, policies: ['transit-d1-4'] });
  expect(approved.decision).toMatchObject({
    version: ASSEMBLY_VERSION, affordable: true, approved: true, budget: ASSEMBLY_BUDGET,
    cost: 80000, remainingBudget: 420000, observationCutoff: 2,
    tally: { support: 3, oppose: 0, abstain: 1 },
  });
  expect(position(approved, 'mobility').evidence).toEqual([commute]);
  expect(position(approved, 'housing').vote).toBe('abstain');
  expect(deliberate({ ...input, visitorVote: 'oppose' }).decision.approved).toBe(false);
});

test('unobserved and conflicting readings abstain and a budget cap cannot be outvoted', () => {
  const input = { baseline, policyId: 'transit-d1-4', visitorVote: 'support' };
  const unavailable = deliberate({ ...input, observations: [{ ...commute, month: 3 }] });
  expect(position(unavailable, 'mobility').vote).toBe('abstain');
  expect(unavailable.decision.approved).toBe(false);
  const ambiguous = deliberate({ ...input, observations: [commute, { ...commute, id: 'conflict', value: 10 }] });
  expect(position(ambiguous, 'mobility').vote).toBe('abstain');
  const wrongUnit = deliberate({ ...input, observations: [{ ...commute, unit: 'hours' }] });
  const wrongSeed = deliberate({ ...input, observations: [{ ...commute, provenance: { ...commute.provenance, seed: 7 } }] });
  expect([wrongUnit.decision.approved, wrongSeed.decision.approved]).toEqual([false, false]);

  const observations = [{ ...commute, districtId: 'd0', metric: 'meanRent', value: 1500, unit: 'modeled USD/month' }];
  const affordable = deliberate({ ...input, policyId: 'housing-d0-3', observations });
  expect(affordable.decision.approved).toBe(true);
  const expensive = deliberate({ ...input, policyId: 'housing-d0-6', observations });
  expect(expensive.decision).toMatchObject({ approved: false, affordable: false, cost: 840000 });
  expect(position(expensive, 'housing').vote).toBe('support');
  expect(position(expensive, 'treasury').vote).toBe('oppose');
  expect(() => deliberate({ ...input, policyId: 'unsupported' })).toThrow('City catalog');
  expect(() => deliberate({ ...input, visitorVote: 'no' })).toThrow('visitor vote');
});
