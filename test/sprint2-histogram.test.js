import { expect, test } from 'bun:test';
import { replayCommuteSample, runCommuteEnsemble } from '../world/living-city/quests.js';
import { HISTOGRAM_OPTIONS, summarizeHistogram } from '../world/sprint2/histogram-data.js';

test('bins reconcile with 100 actual Living City pairs and their recorded trips', () => {
  const result = runCommuteEnsemble(HISTOGRAM_OPTIONS);
  const summary = summarizeHistogram(result.samples);
  expect(result.samples).toHaveLength(100);
  expect(new Set(result.samples.map(sample => sample.seed)).size).toBe(100);

  for (const sample of result.samples) {
    for (const arm of [sample.baseline, sample.intervention]) {
      expect(arm.commuteMinutes).toBe(arm.participant.trip?.experiencedMinutes ?? null);
    }
  }

  expect(summary.measured).toBe(95);
  expect(summary.missing).toHaveLength(5);
  expect(summary.unreported).toEqual([]);
  expect(summary.shorter).toBe(92);
  expect(summary.unchanged).toBe(3);
  expect(summary.longer).toBe(0);
  expect(summary.mean).toBeCloseTo(-53.41, 2);
  expect(summary.median).toBeCloseTo(-56.79, 2);
  expect(summary.bins.map(bin => bin.count)).toEqual([0, 89, 0, 3, 3, 0, 0, 0, 0]);

  const index = result.samples.findIndex(sample => sample.shock && sample.delta.commuteMinutes < 0);
  expect(index).toBeGreaterThanOrEqual(0);
  const replay = replayCommuteSample({ ...HISTOGRAM_OPTIONS, index });
  expect(replay.delta).toEqual(result.samples[index].delta);
  expect(replay.baseline.state.seed).toBe(replay.seed);
  expect(replay.intervention.state.seed).toBe(replay.seed);

  const partial = summarizeHistogram(result.samples.slice(1));
  expect(partial.unreported).toEqual([0]);
  expect(partial.measured + partial.missing.length + partial.unreported.length).toBe(100);
}, 120_000);

test('bin edges and exact zero each belong to one bin', () => {
  const samples = [-61, -60, -40, -20, 0, 1, 20, 40, 60].map((delta, index) => ({
    index,
    baseline: { commuteMinutes: 100 },
    intervention: { commuteMinutes: 100 + delta },
  }));
  const summary = summarizeHistogram(samples);
  expect(summary.bins.map(bin => bin.count)).toEqual(Array(9).fill(1));
  expect(summary.unchanged).toBe(1);
  expect(summary.median).toBe(0);
  expect(summarizeHistogram([]).mean).toBeNull();
});
