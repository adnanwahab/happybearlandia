import { test, expect } from 'bun:test';
import { focusableControls, observeReducedMotion } from '../world/onboarding/accessibility.js';
test('hidden sheets expose no focus targets', () => {
  expect(focusableControls({ hidden: true })).toEqual([]);
  expect(focusableControls({ style: { display: 'none' } })).toEqual([]);
});
test('reduced motion updates live and unsubscribes', () => {
  let listener; const values = [];
  const query = { matches: false, addEventListener: (_, fn) => listener = fn, removeEventListener: (_, fn) => { expect(fn).toBe(listener); listener = null; } };
  const dispose = observeReducedMotion({ matchMedia: () => query }, value => values.push(value));
  query.matches = true; listener(); dispose();
  expect(values).toEqual([false, true]); expect(listener).toBeNull();
});
