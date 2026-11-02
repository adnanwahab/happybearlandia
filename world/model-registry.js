export const MODEL_REGISTRY = Object.freeze({
  simulator: { id: "hbl-civic-dynamics", version: "2.0.0", adapterId: "hbl-civic-dynamics.v2" },
  worldGenerator: { id: "scenario-family-generator", version: "2.0.0", schemaVersion: "world-batch.v2" },
  causalGraph: { id: "hbl-causal-graph", version: "1.0.0", schemaVersion: "hbl-causal-graph.v1" },
  random: { id: "mulberry32", version: "1.0.0" },
  parameterSchema: { id: "hbl-world-parameters", version: "1.0.0" },
});

export function currentModelDescriptor(options = {}) {
  return {
    schemaVersion: "hbl-model-descriptor.v1",
    simulator: options.simulator || MODEL_REGISTRY.simulator,
    worldGenerator: options.worldGenerator || MODEL_REGISTRY.worldGenerator,
    causalGraph: options.causalGraph || MODEL_REGISTRY.causalGraph,
    random: options.random || MODEL_REGISTRY.random,
    parameterSchema: options.parameterSchema || MODEL_REGISTRY.parameterSchema,
    gitCommit: options.gitCommit || globalThis?.HBL_GIT_COMMIT || null,
  };
}

export function decorateExperimentModel(experiment, options = {}) {
  return { ...experiment, model: currentModelDescriptor(options) };
}

export function modelCompatibility(saved, current = currentModelDescriptor()) {
  const keys = ["simulator", "worldGenerator", "causalGraph", "random", "parameterSchema"];
  const differences = keys.flatMap((key) => {
    const a = saved?.[key];
    const b = current?.[key];
    if (!a || !b) return [{ key, saved: a || null, current: b || null, reason: "missing" }];
    if (a.id !== b.id || a.version !== b.version) return [{ key, saved: a, current: b, reason: "version-mismatch" }];
    return [];
  });
  return { compatible: differences.length === 0, exact: differences.length === 0 && (saved?.gitCommit || null) === (current?.gitCommit || null), differences };
}
