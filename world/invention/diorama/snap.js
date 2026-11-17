import { BLOCK, checkDraft } from './model.js';

// Editing affordance only: 5 m grid, 6 m attraction radius. No location effects.
export function resolveSnap(drafts, index, location) {
  if (!drafts[index] || ![location.x, location.z].every(Number.isFinite)) return null;
  const candidates = [];
  for (let x = BLOCK.minX; x <= BLOCK.maxX; x += 5) {
    for (let z = BLOCK.minZ; z <= BLOCK.maxZ; z += 5) {
      const distance = (x - location.x) ** 2 + (z - location.z) ** 2;
      if (distance <= 36) candidates.push({ x, z, distance });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.x - b.x || a.z - b.z);
  for (const { x, z } of candidates) {
    const next = drafts.map((draft, i) => i === index ? { ...draft, location: { ...location, x, z } } : draft);
    if (checkDraft(next).valid) return next[index].location;
  }
  return null;
}

export function createHaptics(navigator) {
  let last = -Infinity;
  return ({ enabled, initiated, reduced, now }) => {
    if (!enabled || !initiated || reduced || typeof navigator?.vibrate !== 'function' || now - last < 80) return false;
    last = now;
    try { return navigator.vibrate(8) === true; } catch { return false; }
  };
}
