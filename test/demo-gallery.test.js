import { test, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import { buildCatalog, filterCatalog, MEDIA } from '../tools/demo-gallery/manifest.js';
import { EXPERIENCES } from '../world/universe/registry.js';

test('versioned gallery preserves registry identities and destinations without live previews', () => {
  const catalog = buildCatalog();
  expect(new Set(catalog.map(item => item.id)).size).toBe(catalog.length);
  for (const original of EXPERIENCES) {
    const card = catalog.find(item => item.id === original.id);
    expect(card.route).toBe(original.route);
    expect(card.title).toBe(original.title);
    expect(card.image).toBe(MEDIA[original.id]?.image);
    expect(card.video).toBe(MEDIA[original.id]?.video);
  }
  for (const card of filterCatalog(catalog, 'visualizations')) {
    expect(existsSync('.' + card.route + (card.route.endsWith('/') ? 'index.html' : ''))).toBe(true);
  }
  expect(existsSync('./data/launch/two-futures.png')).toBe(true);
  expect(existsSync('./docs/evidence/she64/one-city-two-futures.mp4')).toBe(true);
});
test('collection/search includes tools, missing media, empty and stable homepage paths', () => {
  const catalog = buildCatalog();
  expect(filterCatalog(catalog, 'tools').every(item => item.route.startsWith('/tools/'))).toBe(true);
  expect(filterCatalog(catalog, 'all', '  RAINBOW BRAIN  ')).toHaveLength(1);
  expect(filterCatalog(catalog, 'all', 'no-such-demo-999')).toEqual([]);
  expect(catalog.some(item => !item.image && !item.video)).toBe(true);
  expect(catalog[0]).toMatchObject({ image: '/preview.jpg', video: '/preview.mp4' });
});
