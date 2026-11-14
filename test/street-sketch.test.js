import { expect, test } from 'bun:test';
import { runSketch, validateSketch, snapPoint, SKETCH_VERSION } from '../world/invention/sketch/model.js';
const proposal = { version: SKETCH_VERSION, kind: 'transit', points: [[120, 40], [160, 80]], policyId: 'transit-d1-8', cost: 160000, seed: 2911, months: 12 };
test('snapping is bounded and deterministic', () => {
  expect(snapPoint(-10, 307)).toEqual([0, 300]);
  expect(snapPoint(131, 49)).toEqual([140, 40]);
  expect(() => snapPoint(NaN, 2)).toThrow();
});
test('submission retains geometry and cost without changing recipe or parent inputs', () => {
  const before = JSON.stringify(proposal);
  const run = runSketch(proposal);
  expect(JSON.stringify(proposal)).toBe(before);
  expect(run.proposal.points).toEqual(proposal.points);
  expect(run.proposal.cost).toBe(160000);
  expect(run.proposal.plan.policies).toEqual(['transit-d1-8']);
  expect(run.alternative.start).toEqual(run.baseline.start);
  expect(run.alternative.final.meanCommuteMinutes).toBeLessThan(run.baseline.final.meanCommuteMinutes);
  expect(runSketch(JSON.parse(before))).toEqual(run);
  expect(runSketch({ ...proposal, points: [[140, 100], [180, 200]] }).alternative).toEqual(run.alternative);
});
test('unsupported network edits and malformed assumptions refuse before execution', () => {
  for (const patch of [
    { kind: 'road' }, { version: 'future' }, { points: [] }, { points: [[120, 40], [120, 40]] },
    { points: [[120, 40], [200, 40]] }, { points: [[121, 40], [160, 80]] },
    { points: [[120, 40], [Infinity, 80]] }, { cost: 0 }, { policyId: 'transit-d0-8' },
    { policyId: 'road-d1-8' }, { seed: -1 }, { months: 0 }, { points: Array(33).fill([120, 40]) },
  ]) expect(() => runSketch({ ...proposal, ...patch })).toThrow();
  const normalized = validateSketch(proposal);
  normalized.points[0][0] = 0;
  expect(proposal.points[0][0]).toBe(120);
});
