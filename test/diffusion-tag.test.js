import { expect, test } from 'bun:test';
import { createDiffusionTag } from '../world/collective-mind/diffusion-tag.js';
import checkpoint from '../world/collective-mind/diffusion-demo.json';
import expected from '../world/collective-mind/diffusion-expected.json';

test('authored checkpoint replays one real tick with correct and incorrect predictions', () => {
  const before = JSON.stringify(checkpoint);
  const recipients = expected.events.filter(e => e.tick === 1).map(e => e.receiverId);
  const success = createDiffusionTag(checkpoint).reveal(recipients, expected);
  const failure = createDiffusionTag(checkpoint).reveal(['Dee'], expected);
  expect(success.correct).toBe(true);
  expect(failure.correct).toBe(false);
  expect(failure.actual).toEqual(success.actual);
  expect(success.actual).toEqual(expected);
  expect(JSON.stringify(checkpoint)).toBe(before);
  for (const e of success.events) {
    const parent = success.actual.events[e.parentId];
    expect(parent.receiverId).toBe(e.sourceId);
    expect(parent.tick).toBeLessThan(e.tick);
    expect(e.distance).toBeLessThanOrEqual(checkpoint.recipe.radius);
    expect(e.adoptionDraw).toBeLessThan(checkpoint.recipe.probability);
  }
  expect(success.events.some(e => e.receiverId === 'Dee')).toBe(false);
});

test('cancel, missing source, source mutation and replay mismatch cannot invent outcomes', () => {
  expect(() => createDiffusionTag(null)).toThrow('No source data');
  const session = createDiffusionTag(checkpoint);
  expect(Object.isFrozen(session.source.recipe.residents[0])).toBe(true);
  expect(session.cancel()).toEqual({ state: 'cancelled' });
  expect(() => session.reveal([])).toThrow('Load the demo');
  const bad = structuredClone(checkpoint); bad.events[0].receiverId = 'Dee';
  expect(() => createDiffusionTag(bad)).toThrow('mismatch');
  const version = structuredClone(checkpoint); version.recipe.rules = 'future';
  expect(() => createDiffusionTag(version)).toThrow('mismatch');
  const expectedBad = structuredClone(expected); expectedBad.events = [];
  expect(() => createDiffusionTag(checkpoint).reveal([], expectedBad)).toThrow('mismatch');
  expect(() => createDiffusionTag(checkpoint).reveal(['stranger'])).toThrow('frozen graph');
});
