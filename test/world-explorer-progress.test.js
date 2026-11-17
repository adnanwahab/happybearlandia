import {test, expect} from 'bun:test';
import {createExplorerProgress} from '../world/onboarding/explorer-progress.js';
import {placeURL, PLACES} from '../world/place-picker.js';

test('a real postcard arrival retains step one through navigation', () => {
  const destination = new URL(placeURL(PLACES[0], 'https://example.test/world?renderer=webgl'));
  const progress = createExplorerProgress(destination.search);
  expect(progress.complete('share')).toBe(false);
  expect(progress.complete('policy')).toBe(true);
});

test('both distinct steps are required in either order; other actions do not count', () => {
  for (const steps of [['place', 'policy'], ['policy', 'place']]) {
    const progress = createExplorerProgress('');
    expect(progress.complete('minimize')).toBe(false);
    expect(progress.complete(steps[0])).toBe(false);
    expect(progress.complete(steps[0])).toBe(false);
    expect(progress.complete(steps[1])).toBe(true);
    expect(progress.complete('share')).toBe(true);
  }
});

test('a fresh visit or unrelated arrival value does not inherit completion', () => {
  for (const search of ['', '?arrival=0', '?arrival=true']) {
    expect(createExplorerProgress(search).complete('policy')).toBe(false);
  }
});
