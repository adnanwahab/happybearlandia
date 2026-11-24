import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { createModel } = createRequire(import.meta.url)('../world/nested-ballot/model.js');

// Minimal h3 stand-in: a "cell" is "lat,lng,res,i" so named regions resolve without the h3-js package.
const h3 = {
  latLngToCell: (lat, lng, res) => `${lat},${lng},${res},0`,
  gridDisk: (cell, k) => Array.from({ length: 1 + 3 * k * (k + 1) }, (_, i) => cell.replace(/,0$/, `,${i}`)),
  cellToLatLng: cell => cell.split(',').slice(0, 2).map(Number),
};

test('five scales with a question and journal prompt at each', () => {
  const m = createModel(h3);
  expect(m.LEVELS).toEqual(['Global', 'Country', 'City', 'Neighborhood', 'Block']);
  expect(m.QUESTIONS).toHaveLength(5);
  expect(m.PROMPTS).toHaveLength(5);
});

test('named regions resolve by path and keep their parent chain', () => {
  const m = createModel(h3);
  const katy = m.get('global/usa/houston/katy');
  expect(katy.name).toBe('Katy');
  expect(katy.level).toBe(3);
  expect(katy.parent.name).toBe('Houston');
  expect(katy.parent.parent.parent).toBe(m.ROOT);
  expect(m.get('global/nowhere')).toBeNull();
});

test('sibling regions never share a cell', () => {
  const m = createModel(h3);
  const seen = new Set();
  for (const city of m.childrenOf(m.get('global/usa/houston'))) for (const cell of city.hexes) {
    expect(seen.has(cell)).toBe(false);
    seen.add(cell);
  }
});

test('example tallies are deterministic per region and question', () => {
  const m = createModel(h3);
  const a = m.seededTally('global/usa', 'global');
  expect(m.seededTally('global/usa', 'global')).toEqual(a);
  expect(a.yes + a.no).toBeGreaterThan(0);
});

test('page loads its model from the served world path', () => {
  const html = readFileSync(new URL('../world/nested-ballot/index.html', import.meta.url), 'utf8');
  expect(html).toContain('<script src="/world/nested-ballot/model.js"></script>');
  expect(html).toContain('H3ClusterLayer');
});
