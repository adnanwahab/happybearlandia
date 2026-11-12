import { test, expect } from 'bun:test';
import { compareLocalIdea, runLocalIdea, validateLocalIdea } from '../world/civilization/ideas/local.js';
const options = { residents: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 },
  { id: 'c', x: 2, y: 0 }, { id: 'isolated', x: 9, y: 0 }], originId: 'a', radius: 1, probability: 1, ticks: 3, seed: 42 };

test('local synchronous hops reach origin with exact boundary contact and isolated residents', () => {
  const run = runLocalIdea(options);
  expect(run.curve.map(r => r.informed)).toEqual([1, 2, 3, 3]);
  expect(run.informedIds).toEqual(['a', 'b', 'c']);
  for (const event of run.events.slice(1)) {
    const parent = run.events[event.parentId];
    expect(parent.receiverId).toBe(event.sourceId);
    expect(parent.tick).toBeLessThan(event.tick);
    expect(event.hopCount).toBe(parent.hopCount + 1);
    expect(event.distance).toBeLessThanOrEqual(options.radius);
    let root = event;
    while (root.parentId !== null) root = run.events[root.parentId];
    expect(root.receiverId).toBe('a');
  }
  expect(validateLocalIdea(run)).toBe(true);
  const corrupt = structuredClone(run); corrupt.events[2].parentId = 2;
  expect(() => validateLocalIdea(corrupt)).toThrow('mismatch');
});

test('matched controls, deterministic replay and input order independence', () => {
  const input = { ...options, probability: 0.65, ticks: 20 };
  const pair = compareLocalIdea(input);
  expect(compareLocalIdea(input)).toEqual(pair);
  expect(runLocalIdea({ ...input, residents: [...input.residents].reverse() })).toEqual(pair.treatment);
  expect(pair.control.events).toHaveLength(1);
  expect(pair.control.curve.every(r => r.informed === 1)).toBe(true);
  expect(pair.curve.at(-1).difference).toBe(2);
  expect(pair.treatment.recipe).toEqual({ ...pair.control.recipe, sharing: true });
});

test('zero exposure, no adoption and invalid inputs', () => {
  expect(runLocalIdea({ ...options, radius: 0 }).events).toHaveLength(1);
  expect(runLocalIdea({ ...options, probability: 0 }).events).toHaveLength(1);
  expect(runLocalIdea({ ...options, ticks: 0 }).curve).toEqual([{ tick: 0, informed: 1 }]);
  for (const bad of [{ radius: -1 }, { probability: NaN }, { ticks: 1001 }, { seed: -1 },
    { sharing: 1 }, { originId: 'missing' }, { residents: [options.residents[0], options.residents[0]] }])
    expect(() => runLocalIdea({ ...options, ...bad })).toThrow();
});
