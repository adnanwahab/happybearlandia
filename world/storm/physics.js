export const WATER_MODEL_VERSION = 'heightfield-water.v1';
export const WATER_DEFAULTS = Object.freeze({ size: 32, rainRate: 0, steps: 60 });
export const WATER_LIMITS = Object.freeze({ maxSize: 128, maxSteps: 240, maxElevation: 10_000, maxWaterPerStep: 100 });

export const FLOW_COEFFICIENT = 0.125;
export const NEIGHBOR_CAP = 0.25;

function bounded(value, min, max, name, integer = false) {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} must be ${integer ? 'an integer' : 'a finite number'} from ${min} to ${max}.`);
  }
  return value;
}

function field(input, length, min, max, name) {
  if (input === undefined) return new Float32Array(length);
  if ((!Array.isArray(input) && !ArrayBuffer.isView(input)) || input.length !== length) {
    throw new Error(`${name} must have ${length} entries.`);
  }
  const copy = new Float32Array(length);
  for (let i = 0; i < length; i++) copy[i] = bounded(input[i], min, max, name);
  return copy;
}

/** Copy inputs into f32 fields shared by both backends. All rates are per step. */
export function prepareWaterInput(input = {}) {
  const size = bounded(input.size ?? WATER_DEFAULTS.size, 2, WATER_LIMITS.maxSize, 'Grid size', true);
  const steps = bounded(input.steps ?? WATER_DEFAULTS.steps, 0, WATER_LIMITS.maxSteps, 'Step count', true);
  const rainRate = Math.fround(bounded(input.rainRate ?? WATER_DEFAULTS.rainRate, 0, WATER_LIMITS.maxWaterPerStep, 'Rain rate'));
  const terrain = field(input.terrain, size ** 2, -WATER_LIMITS.maxElevation, WATER_LIMITS.maxElevation, 'Terrain');
  const drains = field(input.drains, size ** 2, 0, WATER_LIMITS.maxWaterPerStep, 'Drain field');
  return { size, steps, rainRate, terrain, drains };
}

const f32 = Math.fround;

function availableWater(water, rain, drain) {
  return Math.max(0, f32(f32(water + rain) - drain));
}

function transfer(source, slope) {
  return Math.min(source * NEIGHBOR_CAP, Math.max(0, slope * FLOW_COEFFICIENT));
}

/**
 * Each dry-start step adds rain, removes up to the local drain capacity, then
 * exchanges water with the four adjacent cells using their post-drain surface heights.
 * A cell can send at most one quarter of its available depth across any edge.
 * Equal-area cells and closed boundaries make each edge transfer volume conservative.
 */
export function simulateWater(input) {
  const config = prepareWaterInput(input);
  const { size, steps, rainRate, terrain, drains } = config;
  const length = size ** 2;
  const remaining = new Float32Array(length);
  const surface = new Float32Array(length);
  const frames = [new Float32Array(length)];
  for (let step = 0; step < steps; step++) {
    const previous = frames[step];
    const next = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      remaining[i] = availableWater(previous[i], rainRate, drains[i]);
      surface[i] = f32(terrain[i] + remaining[i]);
    }

    function net(from, to) {
      const slope = f32(surface[from] - surface[to]);
      return f32(transfer(remaining[to], -slope) - transfer(remaining[from], slope));
    }

    for (let i = 0; i < length; i++) {
      const x = i % size;
      let depth = remaining[i];
      if (x > 0) depth = f32(depth + net(i, i - 1));
      if (x < size - 1) depth = f32(depth + net(i, i + 1));
      if (i >= size) depth = f32(depth + net(i, i - size));
      if (i < length - size) depth = f32(depth + net(i, i + size));
      next[i] = Math.max(0, depth);
    }
    frames.push(next);
  }
  return completeWaterSimulation(config, frames, 'CPU');
}

/** Shared ledger. Depth sums represent volume divided by the common cell area. */
export function completeWaterSimulation({ size, steps, rainRate, drains }, frames, backend) {
  const accounting = [{ step: 0, rainAdded: 0, drained: 0, stored: 0, residual: 0 }];
  let drained = 0;
  const length = size ** 2;
  for (let step = 1; step <= steps; step++) {
    const frame = frames[step];
    const previous = frames[step - 1];
    let stored = 0;
    for (let i = 0; i < length; i++) {
      const depth = frame[i];
      if (!Number.isFinite(depth) || depth < 0) throw new Error('The water solver returned an invalid depth.');
      stored += depth;
      drained += Math.min(f32(previous[i] + rainRate), drains[i]);
    }
    const rainAdded = step * length * rainRate;
    accounting.push({ step, rainAdded, drained, stored, residual: stored - (rainAdded - drained) });
  }
  return { modelVersion: WATER_MODEL_VERSION, size, steps, backend, frames, accounting };
}
