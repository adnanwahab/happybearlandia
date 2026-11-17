import { expect, test } from 'bun:test';
import { atmosphereState } from '../world/storm/atmosphere.js';

test('selected steps produce bounded decorative phase without inferred weather', () => {
  for (const step of [0, 1, 23, 24, 100, 0, 60]) {
    const state = atmosphereState(step);
    expect(state.available).toBe(true);
    expect(state.phase).toBeGreaterThanOrEqual(0);
    expect(state.phase).toBeLessThan(1);
    expect(state.label).toContain(`Step ${step}`);
    expect(state.label).toContain('Wind speed (m/s) and direction: unavailable');
    expect(state.label).toContain('does not indicate storm strength');
  }
  expect(atmosphereState(24)).toEqual({ ...atmosphereState(0), label: atmosphereState(24).label });
});

test('empty and invalid snapshot selection clear the atmosphere', () => {
  for (const step of [undefined, null, -1, NaN, Infinity, .5, '1']) {
    expect(atmosphereState(step)).toEqual({ available: false, phase: 0,
      label: 'No storm snapshot. Wind speed, direction and cloud cover unavailable.' });
  }
});
