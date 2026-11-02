import { describe, expect, test } from 'bun:test';
import { normalizeLiveTimeline } from '../world/live-timeline-view.js';

describe('live timeline normalization', () => {
  test('preserves actual simulator metrics and score in chronological order', () => {
    expect(normalizeLiveTimeline({ timeline: [{ year: 2, score: 55, metrics: { housing_cost_burden: .3 } }, { year: 1, metrics: { housing_cost_burden: .31 } }] })).toEqual([
      { year: 1, metrics: { housing_cost_burden: .31 } },
      { year: 2, metrics: { housing_cost_burden: .3, score: 55 } },
    ]);
  });
  test('averages ensembles per metric without treating missing values as zero', () => {
    expect(normalizeLiveTimeline({ worlds: [
      { result: { timeline: [{ year: 1, score: 40, metrics: { x: 2, y: 10 } }] } },
      { result: { timeline: [{ year: 1, score: 60, metrics: { x: 6, y: null } }, { year: 2, metrics: { x: 8 } }] } },
    ] })).toEqual([{ year: 1, metrics: { x: 4, y: 10, score: 50 } }, { year: 2, metrics: { x: 8 } }]);
  });
  test('rejects invalid data and accepts aggregate metric means', () => {
    expect(normalizeLiveTimeline(null)).toEqual([]);
    expect(normalizeLiveTimeline({ timeline: [null, { year: NaN }, { year: 1, metrics: { x: { mean: 3 }, bad: Infinity } }] })).toEqual([{ year: 1, metrics: { x: 3 } }]);
  });
});
