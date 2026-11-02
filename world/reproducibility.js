function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function fingerprint(value) {
  const text = stableStringify(value);
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    a ^= code;
    a = Math.imul(a, 0x01000193);
    b ^= Math.imul(code + i, 0x85ebca6b);
    b = Math.imul(b ^ (b >>> 13), 0xc2b2ae35);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildReproducibilityManifest(input = {}) {
  const experiment = input.experiment || input;
  const worldBatch = input.worldBatch || null;
  const simulationBatch = input.simulationBatch || null;
  return {
    schemaVersion: "hbl-reproducibility.v1",
    model: experiment?.model || null,
    seed: worldBatch?.seed ?? experiment?.experiment?.seed ?? null,
    manifestHash: fingerprint({ plan: experiment?.plan, assumptions: experiment?.assumptions, worldModel: experiment?.worldModel, model: experiment?.model }),
    worldsHash: worldBatch ? fingerprint({ seed: worldBatch.seed, worlds: worldBatch.worlds }) : null,
    resultsHash: simulationBatch ? fingerprint({ adapter: simulationBatch.adapter, simulations: simulationBatch.simulations }) : null,
  };
}

export function compareReproducibility(a, b) {
  const fields = ["manifestHash", "worldsHash", "resultsHash"];
  const checks = Object.fromEntries(fields.map((field) => [field, { expected: a?.[field] || null, actual: b?.[field] || null, match: Boolean(a?.[field]) && a?.[field] === b?.[field] }]));
  return { exact: fields.every((field) => checks[field].match), checks };
}

export const __test = { stableStringify };
