function hashString(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveSeed(...parts) {
  return hashString(parts.map((part) => String(part ?? "")).join("\u241f"));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolveVariable(variable, override) {
  if (!override || typeof override !== "object") return variable;
  const rawMin = finite(override.min ?? override.range?.min, finite(variable.range?.min, 0));
  const rawMax = finite(override.max ?? override.range?.max, finite(variable.range?.max, 1));
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax);
  const baseline = clamp(finite(override.baseline, finite(variable.baseline, (min + max) / 2)), min, max);
  return {
    ...variable,
    baseline,
    range: { min, max },
    distribution: { ...(variable.distribution || {}), min, max, mode: baseline },
    locked: typeof override.locked === "boolean" ? override.locked : Boolean(variable.locked),
    source: "user-override",
  };
}

function sampleTriangular(random, min, mode, max) {
  if (max <= min) return min;
  const safeMode = clamp(mode, min, max);
  const split = (safeMode - min) / (max - min);
  const u = random();
  if (u < split) return min + Math.sqrt(u * (max - min) * (safeMode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - safeMode));
}

function sampleNormal(random, mean, stddev, min, max) {
  const u1 = Math.max(Number.EPSILON, random());
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return clamp(mean + z * stddev, min, max);
}

export function sampleVariable(variable, random) {
  const min = finite(variable.range?.min, 0);
  const max = finite(variable.range?.max, 1);
  const baseline = clamp(finite(variable.baseline, (min + max) / 2), min, max);
  if (variable.locked || max <= min) return baseline;

  const distribution = variable.distribution || {};
  switch (distribution.type) {
    case "uniform":
      return min + random() * (max - min);
    case "normal":
      return sampleNormal(
        random,
        finite(distribution.mean, baseline),
        Math.max(0, finite(distribution.stddev, (max - min) / 6)),
        min,
        max,
      );
    case "triangular":
    default:
      return sampleTriangular(random, min, finite(distribution.mode, baseline), max);
  }
}

export function generateWorlds(experiment, options = {}) {
  const configuredRuns = Math.round(finite(options.runs, finite(experiment?.experiment?.runs, 100)));
  const runs = Math.max(1, Math.min(100000, configuredRuns));
  const configuredSeed = options.seed ?? experiment?.experiment?.seed;
  const baseSeed = configuredSeed === null || configuredSeed === undefined
    ? deriveSeed(experiment?.id || experiment?.plan?.id || "hbl-experiment")
    : (Math.floor(finite(configuredSeed, 0)) >>> 0);
  const overrides = options.overrides && typeof options.overrides === "object" ? options.overrides : {};
  const variables = (experiment?.worldModel?.variables || []).map((variable) => resolveVariable(variable, overrides[variable.id]));

  const worlds = [];
  for (let index = 0; index < runs; index++) {
    const worldSeed = deriveSeed(baseSeed, index);
    const conditions = {};
    const normalized = {};
    const deviations = {};

    for (const variable of variables) {
      const min = finite(variable.range?.min, 0);
      const max = finite(variable.range?.max, 1);
      const baseline = clamp(finite(variable.baseline, (min + max) / 2), min, max);
      const random = mulberry32(deriveSeed(worldSeed, variable.id));
      const value = sampleVariable(variable, random);
      const span = max - min;
      conditions[variable.id] = value;
      normalized[variable.id] = span > 0 ? (value - min) / span : 0.5;
      deviations[variable.id] = span > 0 ? (value - baseline) / span : 0;
    }

    worlds.push({
      id: `world_${String(index + 1).padStart(5, "0")}`,
      index,
      seed: worldSeed,
      conditions,
      normalized,
      deviations,
    });
  }

  return {
    schemaVersion: "world-batch.v1",
    experimentId: experiment?.id || null,
    seed: baseSeed,
    runs,
    variableIds: variables.map((variable) => variable.id),
    worlds,
  };
}

export const __test = { hashString, mulberry32, sampleTriangular, resolveVariable };
