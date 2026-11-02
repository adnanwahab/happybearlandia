/** Simulation-only clock, independent of RAF/camera/geometry/FPS clocks.
 * update(realNow) consumes monotone real milliseconds, returning simulation
 * milliseconds. First update after creation, pause/resume, or a speed change
 * anchors the clock: elapsed wall time is never applied retrospectively.
 * onChange(state) fires only on actual control changes. Use it to synchronize
 * the active simulation runtime; subscribe to that runtime's actual paused state
 * and call pause/resume here (idempotently) for per-panel controls.
 * Speed is a positive multiplier, NOT the paused state. Long gaps are capped
 * to maxFrameMs (100 by default); dropped wall time is never accumulated.
 */
export function createSimulationPlayback({ initialSpeed = 10, onChange, maxFrameMs = 100 } = {}) {
  const validSpeed = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100;
  if (!validSpeed(initialSpeed)) throw new RangeError('Simulation speed must be greater than 0 and at most 100.');
  if (!Number.isFinite(maxFrameMs) || maxFrameMs <= 0 || maxFrameMs > 1000) throw new RangeError('maxFrameMs must be greater than 0 and at most 1000.');
  let paused = false, speed = initialSpeed, simulationNow = 0, lastRealNow = null, anchor = true, destroyed = false;
  const listeners = new Set();
  const getState = () => ({ simulationNow, paused, speed });
  function notify() {
    const state = getState();
    onChange?.(state);
    for (const listener of listeners) listener({ ...state });
  }
  function setPaused(value) {
    if (destroyed || paused === value) return getState();
    paused = value;
    anchor = true;
    notify();
    return getState();
  }
  return {
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    setSpeed(value) {
      if (destroyed) return getState();
      if (!validSpeed(value)) throw new RangeError('Simulation speed must be greater than 0 and at most 100.');
      if (speed !== value) { speed = value; anchor = true; notify(); }
      return getState();
    },
    getState,
    update(realNow) {
      if (!Number.isFinite(realNow)) throw new TypeError('Playback update requires finite real milliseconds.');
      let deltaMs = 0;
      if (!destroyed && !paused && !anchor && lastRealNow !== null && realNow >= lastRealNow) {
        deltaMs = Math.min(maxFrameMs, realNow - lastRealNow) * speed;
        simulationNow += deltaMs;
      }
      // A backwards/discontinuous wall clock is a re-anchor, never negative time.
      lastRealNow = realNow;
      anchor = false;
      return { simulationNow, deltaMs, paused, speed };
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Playback subscriber must be a function.');
      if (destroyed) return () => {};
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    },
    destroy() { destroyed = true; paused = true; anchor = true; listeners.clear(); },
  };
}
