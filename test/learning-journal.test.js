import { expect, test } from 'bun:test';
import { createJournal } from '../world/learning/journal.js';

test('observations and locked forecasts stay separate from revealed outcomes across reload', () => {
  const rows = new Map();
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) };
  const journal = createJournal(storage);
  journal.setCurrent({ id: 'first' });
  journal.setObservations('first', [{ month: 2, districtId: 'd1', metric: 'meanRent', value: 1150 }]);
  expect(() => journal.saveOutcome('first', { resolution: { score: 90 } })).toThrow('Lock a prediction');
  journal.lockPrediction('first', { expected: -10 });
  expect(() => journal.lockPrediction('first', { expected: 99 })).toThrow('locked');
  journal.saveOutcome('first', { resolution: { score: 90 } });
  expect(rows.size).toBe(4);
  const reloaded = createJournal(storage);
  expect(reloaded.current()).toEqual({ id: 'first' });
  expect(reloaded.observations('first')).toHaveLength(1);
  expect(reloaded.prediction('first')).toEqual({ expected: -10 });
  expect(reloaded.history()).toEqual([{ prediction: { expected: -10 }, resolution: { score: 90 } }]);
  reloaded.setCurrent({ id: 'second' });
  expect(reloaded.prediction('second')).toBeNull();
  expect(reloaded.outcome('second')).toBeNull();
  expect(reloaded.history()).toHaveLength(1);
});

test('a disabled storage backend still supports the active visit', () => {
  const journal = createJournal({ getItem() { throw new Error('Disabled'); } });
  expect(journal.current()).toBeNull();
  journal.lockPrediction('first', { expected: -1 });
  journal.saveOutcome('first', { resolution: { score: 90 } });
  expect(journal.volatile).toBe(true);
  expect(journal.history()).toHaveLength(1);
});
