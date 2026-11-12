import { fingerprint, buildReproducibilityManifest, compareReproducibility } from './reproducibility.js';
import { currentModelDescriptor, modelCompatibility } from './model-registry.js';
import { generateWorlds } from './world-generator.js';
import { createHblCivicDynamicsAdapter, simulateExperiment } from './simulation-adapter.js';

export const EXPERIMENT_CODE_VERSION = 'hbl-civic-experiment-lab.v3';

// Only simulation outputs are inferred. Observations must declare their origin.
export function experimentRegistryEntry(record = {}) {
  const snapshot = record.snapshot || record;
  const experiment = snapshot.experiment || {};
  const declared = snapshot.registry || {};
  const resultKind = snapshot.simulationBatch ? 'synthetic'
    : ['measured', 'synthetic'].includes(declared.resultKind) ? declared.resultKind : 'unknown';
  return {
    schemaVersion: 'hbl-experiment-registry.v1',
    hypothesis: declared.hypothesis || experiment.plan?.summary || experiment.plan?.title || 'Unspecified hypothesis',
    intendedUse: declared.intendedUse || (resultKind === 'synthetic' ? 'Explore model behavior; not an empirical forecast.' : 'Unspecified intended use'),
    interventions: experiment.plan?.actions || declared.interventions || [],
    modelVersion: snapshot.simulationBatch?.adapter?.id || experiment.model?.simulator?.adapterId || declared.modelVersion || null,
    model: experiment.model || null,
    codeVersion: snapshot.codeVersion || declared.codeVersion || null,
    gitCommit: experiment.model?.gitCommit || null,
    inputData: { source: experiment.source || experiment.plan?.source || declared.inputData?.source || null,
      variables: experiment.worldModel?.variables || [], overrides: snapshot.overrides || {},
      evidence: experiment.evidenceLayer || null },
    randomSeeds: { base: snapshot.worldBatch?.seed ?? experiment.experiment?.seed ?? null,
      worlds: (snapshot.worldBatch?.worlds || []).map(world => ({ id: world.id, seed: world.seed })) },
    evaluationCriteria: declared.evaluationCriteria || experiment.outcomes?.metricRegistry || [],
    resultKind,
    resultLabel: resultKind === 'measured' ? 'Measured observations' : resultKind === 'synthetic' ? 'Synthetic model results' : 'Unknown result provenance',
    results: snapshot.simulationBatch || declared.results || null,
  };
}

export function filterExperimentRecords(records, filters = {}) {
  const contains = (value, query) => !query || String(value || '').toLowerCase().includes(String(query).trim().toLowerCase());
  return records.filter(record => {
    const entry = experimentRegistryEntry(record);
    return contains(entry.hypothesis, filters.hypothesis)
      && (!filters.modelVersion || entry.modelVersion === filters.modelVersion)
      && (!filters.intervention || entry.interventions.some(action =>
        contains([action.id, action.title, action.description].filter(Boolean).join(' '), filters.intervention)));
  });
}

export async function replayExperimentRecord(record) {
  const snapshot = record?.snapshot || record;
  if (!snapshot?.worldBatch || !snapshot.simulationBatch || !snapshot.reproducibility) {
    throw new Error('Replay requires saved worlds, results and an independent reproducibility manifest');
  }
  const adapter = createHblCivicDynamicsAdapter();
  if (snapshot.simulationBatch.adapter?.id !== adapter.id) throw new Error('Unsupported replay adapter');
  if (snapshot.codeVersion !== EXPERIMENT_CODE_VERSION
    || !modelCompatibility(snapshot.experiment?.model, currentModelDescriptor()).compatible) {
    throw new Error('Unsupported replay model or code version');
  }
  const runs = snapshot.worldBatch.runs;
  if (!Number.isInteger(runs) || runs < 1 || runs > 100000 || snapshot.worldBatch.worlds?.length !== runs) {
    throw new Error('Invalid saved world count');
  }
  // Check stored evidence before recomputing; never compare two fresh runs alone.
  const integrity = compareReproducibility(snapshot.reproducibility, buildReproducibilityManifest(snapshot));
  const worldBatch = generateWorlds(snapshot.experiment, {
    seed: snapshot.worldBatch.seed, runs, overrides: snapshot.overrides || {},
  });
  const simulationBatch = await simulateExperiment(snapshot.experiment, worldBatch, adapter);
  const comparison = compareReproducibility(snapshot.reproducibility,
    buildReproducibilityManifest({ experiment: snapshot.experiment, worldBatch, simulationBatch }));
  return { exact: integrity.exact && comparison.exact, integrity, comparison,
    resultLabel: 'Synthetic model results', resultsHash: fingerprint(simulationBatch.simulations) };
}
