import { expect, test } from 'bun:test';
import { initialMiniatures, checkDraft, confirmBlock, baselineBlock } from '../world/invention/diorama/model.js';

test('draft move/rotation leave authority unchanged; confirmation deterministically changes housing', () => {
  const baseline = baselineBlock();
  const drafts = initialMiniatures();
  drafts[0].location.z = 10;
  drafts[0].location.rotation = Math.PI / 4;
  const before = structuredClone(drafts);
  expect(checkDraft(drafts).valid).toBe(true);
  expect(baselineBlock()).toEqual(baseline);
  const accepted = confirmBlock(drafts);
  expect(accepted.valid).toBe(true);
  expect(accepted.run).toEqual(confirmBlock(drafts).run);
  expect(drafts).toEqual(before);
  expect(drafts.every(draft => draft.status === 'proposed')).toBe(true);
  expect(accepted.run.metrics.housing_supply).toBeGreaterThan(baseline.metrics.housing_supply);
  expect(accepted.run.projects.map(row => row.projectId)).toEqual(drafts.map(row => row.id));
  expect(accepted.run.projects[0].events[0].type).toBe('PROJECT_APPROVED');
  expect(accepted.run.projects[0].states.map(row => row.month)).toEqual(Array.from({ length: 121 }, (_, i) => i));
});

test('bounds, overlaps, duplicate identities and invalid proposals reject without simulation', () => {
  const baseline = baselineBlock();
  for (const mutate of [
    drafts => { drafts[0].location.x = -100; },
    drafts => { drafts[0].location = { ...drafts[1].location }; },
    drafts => { drafts[0].id = drafts[1].id; },
    drafts => { drafts[0].geometry.floors = 0; },
    drafts => { drafts[0].location.x = NaN; },
  ]) {
    const drafts = initialMiniatures(); mutate(drafts);
    const before = structuredClone(drafts);
    expect(confirmBlock(drafts)).toMatchObject({ valid: false, run: null });
    expect(drafts).toEqual(before);
  }
  expect(baselineBlock()).toEqual(baseline);
});
