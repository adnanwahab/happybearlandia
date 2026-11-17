import { test, expect } from 'bun:test';
import { resolveSnap, createHaptics } from '../world/invention/diorama/snap.js';
import { initialMiniatures, checkDraft, confirmBlock } from '../world/invention/diorama/model.js';

test('nearest valid grid anchor uses distance then lower X/Z without mutation', () => {
  const drafts = initialMiniatures(), before = structuredClone(drafts);
  expect(resolveSnap(drafts, 0, { ...drafts[0].location, x: -47.5, z: 2.5 })).toMatchObject({ x: -50, z: 0 });
  expect(resolveSnap(drafts, 0, { ...drafts[0].location, x: -46, z: 1 })).toMatchObject({ x: -45, z: 0 });
  // Closest x=15 overlaps the actual second footprint; next valid x=10 wins.
  expect(resolveSnap(drafts, 0, { ...drafts[0].location, x: 14, z: 0 })).toMatchObject({ x: 10, z: 0 });
  expect(drafts).toEqual(before);
});

test('invalid and missing anchors resist; resolved drafts pass real confirmation', () => {
  const drafts = initialMiniatures();
  for (const x of [1000, NaN, 50]) expect(resolveSnap(drafts, 0, { ...drafts[0].location, x })).toBeNull();
  for (const rotation of [0, Math.PI / 4]) {
    const next = resolveSnap(drafts, 0, { ...drafts[0].location, x: -72, z: 0, rotation });
    expect(next).not.toBeNull(); drafts[0].location = next;
    expect(checkDraft(drafts).valid).toBe(true);
    expect(confirmBlock(drafts).valid).toBe(true);
  }
});

test('vibration requires opt-in, initiation, API and motion preference; failures stay harmless', () => {
  let calls = 0;
  const pulse = createHaptics({ vibrate: ms => { expect(ms).toBe(8); calls++; return true; } });
  const args = { enabled: true, initiated: true, reduced: false, now: 100 };
  for (const override of [{ enabled: false }, { initiated: false }, { reduced: true }]) expect(pulse({ ...args, ...override })).toBe(false);
  expect(calls).toBe(0); expect(pulse(args)).toBe(true);
  expect(pulse({ ...args, now: 120 })).toBe(false); expect(calls).toBe(1);
  expect(createHaptics({})(args)).toBe(false);
  expect(createHaptics({ vibrate: () => false })(args)).toBe(false);
  expect(createHaptics({ vibrate: () => { throw Error('blocked'); } })(args)).toBe(false);
});
