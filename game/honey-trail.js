// Authored playground challenge v1. Coordinates are character-foot positions,
// on the floor except the final drop on the existing shallow staircase.
export const HONEY_DROPS = Object.freeze([
  [0, 0, 5], [7, 0, 9], [15, 0, 13], [23, 0, 9],
  [27, 0, 0], [23, 0, -9], [15, 0.1, -23], [15, 1.3, -35],
].map((point) => Object.freeze(point)));

export function createHoneyTrail() {
  let collected = new Set();
  let elapsed = 0;
  let started = false;
  let best = null;
  const snapshot = () => ({
    collected: [...collected], elapsed, started, best,
    complete: collected.size === HONEY_DROPS.length,
  });
  return {
    snapshot,
    restart() {
      collected = new Set();
      elapsed = 0;
      started = false;
      return snapshot();
    },
    update(position, delta) {
      if (collected.size === HONEY_DROPS.length) return snapshot();
      if (started && Number.isFinite(delta) && delta > 0) elapsed += delta;
      if (!position.every(Number.isFinite)) return snapshot();
      HONEY_DROPS.forEach(([x, y, z], index) => {
        if (Math.hypot(position[0] - x, position[2] - z) <= 1.8 &&
            Math.abs(position[1] - y) <= 2.5) {
          collected.add(index);
          started = true;
        }
      });
      if (collected.size === HONEY_DROPS.length) {
        best = best === null ? elapsed : Math.min(best, elapsed);
      }
      return snapshot();
    },
  };
}
