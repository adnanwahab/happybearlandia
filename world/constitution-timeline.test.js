import { expect, test } from 'bun:test';
import { constitutionCheckpoint } from './constitution-timeline.js';
const result = {
  meta: { metrics: { mood: { better: 'higher' }, displacement: { better: 'lower' } } },
  futures: { metric: 'mood', neutralBand: 0.25 },
  series: [{ year: 1, metrics: { marker: 'early' } }, { year: 5, metrics: { marker: 'late' } }],
  runs: [
    { years: { 1: { baseline: { mood: 10 }, plan: { mood: 10.25 } }, 5: { baseline: { mood: 10 }, plan: { mood: 12 } } } },
    { years: { 1: { baseline: { mood: 10 }, plan: { mood: 9 } }, 5: { baseline: { mood: 10 }, plan: { mood: 11 } } } },
  ],
};
test('checkpoint metrics and split use the selected recorded year', () => {
  const early = constitutionCheckpoint(result, 0), late = constitutionCheckpoint(result, 1);
  expect(early.final.marker).toBe('early'); expect(early.futures).toMatchObject({ year: 1, positive: 0, neutral: 1, negative: 1 });
  expect(late.final.marker).toBe('late'); expect(late.futures).toMatchObject({ year: 5, positive: 2, neutral: 0, negative: 0 });
  expect(result.futures.year).toBeUndefined();
});
test('lower-is-better metrics reverse direction and unknown checkpoints fail', () => {
  const lower = { ...result, meta: { metrics: { mood: { better: 'lower' } } } };
  expect(constitutionCheckpoint(lower, 1).futures.negative).toBe(2);
  expect(() => constitutionCheckpoint(result, 2)).toThrow('Unknown simulation checkpoint');
});
