import { test, expect } from 'bun:test';
import { initialMiniatures } from '../world/invention/diorama/model.js';
import { previewBoundary } from '../world/invention/diorama/boundary-preview.js';
import { buildingFootprint } from '../world/buildings/proposal.js';

test('preview translates exact model polygon without changing source; only accepted drafts are returned', () => {
  const drafts = initialMiniatures(), before = structuredClone(drafts);
  const result = previewBoundary(drafts, drafts[0].id, { x: 5, z: 10 });
  expect(result.valid).toBe(true);
  expect(result.areaSqFt).toBe(16500);
  expect(result.areaSqM).toBe(16500 * .09290304);
  expect(result.polygon).toEqual(buildingFootprint(drafts[0]).map(p => ({ x: p.x + 5, z: p.z + 10 })));
  expect(drafts).toEqual(before);
  result.drafts[0].location.x = 0;
  expect(drafts).toEqual(before);
});
test('overlap, out of bounds, nonfinite offsets and unsupported identities cannot apply', () => {
  const drafts = initialMiniatures(), before = structuredClone(drafts);
  for (const offsets of [{ x: 100, z: 0 }, { x: -100, z: 0 }, { x: NaN, z: 0 }, { x: 0, z: Infinity }]) {
    expect(previewBoundary(drafts, drafts[0].id, offsets)).toMatchObject({ valid: false, drafts: null });
  }
  expect(previewBoundary(drafts, 'parcel-d0')).toMatchObject({ valid: false, polygon: null, drafts: null });
  expect(previewBoundary(drafts, drafts[0].id, { x: 100, z: 0 }).errors.join(' ')).toContain('overlaps');
  expect(drafts).toEqual(before);
});
