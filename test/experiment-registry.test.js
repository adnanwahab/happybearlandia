import { test, expect } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCivicExperiment } from '../world/civic-experiment.js';
import { createExperimentRecord } from '../world/experiment-record.js';
import { generateWorlds } from '../world/world-generator.js';
import { createHblCivicDynamicsAdapter, simulateExperiment } from '../world/simulation-adapter.js';
import { experimentRegistryEntry, filterExperimentRecords, replayExperimentRecord } from '../world/experiment-registry.js';
import { handleExperimentApi } from '../world/experiment-api.js';

async function fixture() {
  const experiment = buildCivicExperiment({ packages: [{ title: 'Housing permits', items: [{ proposal: { title: 'Streamline housing permits' } }] }] }, { seed: 42, runs: 4, years: 2 });
  const overrides = { agency_capacity: { baseline: 0.5, min: 0.5, max: 0.5, locked: true } };
  const worldBatch = generateWorlds(experiment, { overrides });
  const simulationBatch = await simulateExperiment(experiment, worldBatch, createHblCivicDynamicsAdapter());
  return createExperimentRecord({ experiment, overrides, worldBatch, simulationBatch,
    registry: { hypothesis: 'Permits improve housing', intendedUse: 'Explore permitting policy', evaluationCriteria: 'Higher housing supply' } });
}

test('stored API record reruns with saved overrides and independent evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hbl-registry-'));
  try {
    const snapshot = await fixture();
    const call = (path, body) => handleExperimentApi(new Request(`http://localhost/api/experiments${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : {}), { root });
    const saved = await (await call('', { snapshot })).json();
    const report = await (await call(`/${saved.id}/replay`, {})).json();
    expect(report.exact).toBe(true);
    expect(saved.registry).toMatchObject({ hypothesis: 'Permits improve housing', resultKind: 'synthetic', codeVersion: snapshot.codeVersion });
    expect(saved.registry.inputData.overrides).toEqual(snapshot.overrides);
    expect(saved.registry.randomSeeds.worlds).toHaveLength(4);
    const rows = await (await call('?hypothesis=permits&modelVersion=hbl-civic-dynamics.v2&intervention=permits')).json();
    expect(rows).toHaveLength(1);
    expect(await (await call('?hypothesis=absent')).json()).toHaveLength(0);
    expect((await call('/experiment_missing/replay', {})).status).toBe(404);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('replay detects tampering and refuses missing evidence, unsupported adapters and versions', async () => {
  const record = await fixture();
  const changed = structuredClone(record);
  changed.simulationBatch.simulations[0].score += 1;
  expect((await replayExperimentRecord(changed)).exact).toBe(false);
  const changedInput = structuredClone(record);
  changedInput.experiment.experiment.horizonYears += 1;
  expect((await replayExperimentRecord(changedInput)).exact).toBe(false);
  await expect(replayExperimentRecord({ ...record, reproducibility: null })).rejects.toThrow('independent');
  await expect(replayExperimentRecord({ ...record, codeVersion: 'old' })).rejects.toThrow('version');
  const unsupported = structuredClone(record);
  unsupported.experiment.model.random.version = '99';
  await expect(replayExperimentRecord(unsupported)).rejects.toThrow('version');
  unsupported.simulationBatch.adapter.id = 'external';
  await expect(replayExperimentRecord(unsupported)).rejects.toThrow('adapter');
});

test('filters compose and provenance never confuses modeled results with observations', async () => {
  const record = await fixture();
  expect(filterExperimentRecords([record], { hypothesis: 'PERMITS', intervention: 'permits', modelVersion: 'hbl-civic-dynamics.v2' })).toHaveLength(1);
  expect(filterExperimentRecords([record], { modelVersion: 'other' })).toHaveLength(0);
  expect(filterExperimentRecords([record], { intervention: 'unknown' })).toHaveLength(0);
  expect(experimentRegistryEntry({} ).resultLabel).toBe('Unknown result provenance');
  expect(experimentRegistryEntry({ registry: { resultKind: 'measured' } }).resultLabel).toBe('Measured observations');
  record.registry.resultKind = 'measured';
  expect(experimentRegistryEntry(record).resultKind).toBe('synthetic');
  const other = createExperimentRecord({ experiment: record.experiment, registry: { hypothesis: 'Different' } });
  expect(other.id).not.toBe(record.id);
});
