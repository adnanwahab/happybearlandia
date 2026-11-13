import { buildUncertaintyExplorer } from "./uncertainty-explorer.js";
import { buildReproducibilityManifest, fingerprint } from "./reproducibility.js";
import { experimentRegistryEntry, EXPERIMENT_CODE_VERSION } from "./experiment-registry.js";
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function hashString(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createExperimentRecord(input = {}, now = new Date()) {
  if (!input.experiment?.id) throw new Error("createExperimentRecord requires an experiment");
  const parentRecordId = input.parentRecordId || null;
  const revision = Math.max(1, Number(input.revision || input.experiment?.lineage?.revision || 1));
  const identity = {
    experimentId: input.experiment.id,
    planId: input.experiment.plan?.id || null,
    seed: input.worldBatch?.seed ?? input.experiment.experiment?.seed ?? null,
    overrides: input.overrides || {},
    adapterId: input.simulationBatch?.adapter?.id || null,
    parentRecordId,
    revision,
    content: input,
  };

  const record = {
    schemaVersion: "civic-experiment-record.v1",
    id: `record_${fingerprint(identity)}`,
    savedAt: now.toISOString(),
    codeVersion: EXPERIMENT_CODE_VERSION,
    lineage: {
      parentRecordId,
      parentExperimentId: input.experiment?.lineage?.parentExperimentId || null,
      revision,
    },
    experiment: input.experiment,
    overrides: input.overrides || {},
    worldBatch: input.worldBatch || null,
    simulationBatch: input.simulationBatch || null,
    analyzedExperiment: input.analyzedExperiment || null,
    sensitivity: input.sensitivity || null,
    uncertainty: input.simulationBatch ? buildUncertaintyExplorer(input.simulationBatch, input.experiment) : null,
    scenarioComparison: input.scenarioComparison || null,
    improvements: input.improvements || [],
    improvementComparison: input.improvementComparison || null,
    registry: input.registry || {},
    reproducibility: buildReproducibilityManifest({
      experiment: input.experiment,
      worldBatch: input.worldBatch,
      simulationBatch: input.simulationBatch,
    }),
  };
  record.registry = experimentRegistryEntry(record);
  return record;
}

export function summarizeExperimentRecord(record) {
  const registry = experimentRegistryEntry(record);
  return {
    id: record?.id || null,
    savedAt: record?.savedAt || null,
    title: record?.experiment?.plan?.title || "Civic experiment",
    experimentId: record?.experiment?.id || null,
    planId: record?.experiment?.plan?.id || null,
    revision: record?.lineage?.revision || 1,
    parentRecordId: record?.lineage?.parentRecordId || null,
    runs: record?.worldBatch?.runs || record?.simulationBatch?.simulations?.length || 0,
    adapter: record?.simulationBatch?.adapter?.label || null,
    hypothesis: registry.hypothesis,
    modelVersion: registry.modelVersion,
    resultLabel: registry.resultLabel,
  };
}

export function traceRecordLineage(records, recordId) {
  const byId = new Map((records || []).map((record) => [record.id, record]));
  const chain = [];
  const seen = new Set();
  let current = byId.get(recordId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.lineage?.parentRecordId ? byId.get(current.lineage.parentRecordId) : null;
  }
  return chain.reverse();
}

export const __test = { stableStringify, hashString };
