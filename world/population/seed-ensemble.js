import { createPopulationModel, stepPopulation } from './model.js';
import { POPULATION_VERSION } from './contracts.js';
import { selectVisibleIndices } from './visible-sample.js';

export const ENSEMBLE_VERSION = 'population-seed-ensemble.v1';
export const DEFAULT_STUDY = {
  seeds: [11, 29, 42, 73, 101, 211], minutes: 1440, sampleSize: 16,
  cases: [
    { population: 100, representedPopulation: 100 },
    { population: 200, representedPopulation: 200 },
    { population: 400, representedPopulation: 400 },
    { population: 100, representedPopulation: 400 },
    { population: 200, representedPopulation: 400 },
  ],
};
const arms = [
  { id: 'baseline', parameters: {} },
  { id: 'rent-15pct', parameters: { rentMultiplier: .85 } },
  { id: 'transit-double', parameters: { transitService: 2 } },
];
export function summarize(values) {
  if (!Array.isArray(values) || values.some(v => v !== null && !Number.isFinite(v))) throw new Error('Finite observations or explicit null required');
  const sorted = values.filter(v => v !== null).sort((a, b) => a - b), n = sorted.length;
  const mean = n ? sorted.reduce((a, b) => a + b, 0) / n : null;
  const quantile = p => { const x = (n - 1) * p, i = Math.floor(x); return sorted[i] + (sorted[Math.ceil(x)] - sorted[i]) * (x - i); };
  return { requested: values.length, n, missing: values.length - n,
    mean,
    standardDeviation: n > 1 ? Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : null,
    interval: n > 1 ? [quantile(.05), quantile(.95)] : null,
    intervalMethod: 'empirical central 90% across tested seeds; linear quantiles; not a confidence interval or prediction interval' };
}
function validate(study) {
  const unique = rows => new Set(rows).size === rows.length;
  if (Array.isArray(study.cases) && study.cases.some(c => !c || typeof c !== 'object' || Object.keys(c).some(key => !['population', 'representedPopulation'].includes(key)))) throw new Error('Cases accept only population and representedPopulation');
  if (!Array.isArray(study.seeds) || study.seeds.length < 2 || study.seeds.length > 12 || !unique(study.seeds) || study.seeds.some(s => !Number.isInteger(s) || s < 0 || s > 4294967295)) throw new Error('Require 2–12 unique uint32 seeds');
  if (!Number.isInteger(study.minutes) || study.minutes < 1 || study.minutes > 1440 || !Number.isInteger(study.sampleSize) || study.sampleSize < 1 || study.sampleSize > 1000) throw new Error('Invalid horizon or sample size');
  if (!Array.isArray(study.cases) || !study.cases.length || study.cases.length > 6 || !unique(study.cases.map(c => `${c.population}/${c.representedPopulation}`)) || study.cases.some(c => !Number.isInteger(c.population) || c.population < 10 || c.population > 1000 || !Number.isInteger(c.representedPopulation) || c.representedPopulation < c.population || c.representedPopulation > 1000)) throw new Error('Require unique bounded explicit/represented cases (10–1000)');
}
function context(represented) {
  return { districts: [
    { id: 'west', x: 0, z: 0, rent: 1800, housingUnits: represented, jobs: represented, transit: .7, services: .7, environment: .6 },
    { id: 'east', x: 5000, z: 0, rent: 1200, housingUnits: represented, jobs: represented, transit: .7, services: .7, environment: .6 },
  ] };
}
export function observe(model, sampleSize) {
  const p = model.people, h = model.households, n = p.age.length;
  const burdens = Array.from({ length: n }, (_, i) => h.rent[p.household[i]] * 12 / Math.max(1, h.income[p.household[i]]));
  const average = indices => indices.reduce((s, i) => s + burdens[i], 0) / indices.length;
  const full = burdens.reduce((s, v) => s + v, 0) / n;
  const samples = {};
  for (const [name, view] of [['systematic', undefined], ['camera', { x: 0, z: 0 }]]) {
    const indices = selectVisibleIndices(p, sampleSize, view);
    samples[name] = { n: indices.length, indices, mean: average(indices), error: average(indices) - full };
  }
  const counts = Array(h.size.length).fill(0);
  for (const household of p.household) { if (household >= counts.length) throw new Error('Invalid household membership'); counts[household]++; }
  const invariants = {
    populationConserved: n === model.config.population && h.size.reduce((s, v) => s + v, 0) === n,
    householdMembership: counts.every((v, i) => v === h.size[i]),
    tripFlowBalance: model.metrics.trips === Object.values(model.totals.tripCountsByMode).reduce((s, v) => s + v, 0) && model.metrics.activeTrips >= 0 && model.metrics.trips === model.metrics.completedTrips + model.metrics.cancelledTrips + model.metrics.activeTrips,
    finiteBurden: burdens.every(Number.isFinite),
  };
  if (Object.values(invariants).some(v => !v)) throw new Error('Population ensemble invariant failed');
  return { metrics: { personMeanHousingBurden: full, plannedTripMinutes: model.metrics.trips ? model.totals.plannedTravelMinutes / model.metrics.trips : null },
    counts: { people: n, households: h.size.length, trips: model.metrics.trips, completedTrips: model.metrics.completedTrips, representedPeople: n * model.weight }, samples, invariants };
}
export function runSeedEnsemble(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !Object.hasOwn(DEFAULT_STUDY, key))) throw new Error('Unknown study option');
  const study = structuredClone({ ...DEFAULT_STUDY, ...options }); validate(study);
  const rows = [];
  for (const size of study.cases) for (const seed of study.seeds) for (const arm of arms) {
    const worldContext = context(size.representedPopulation);
    const model = createPopulationModel({ ...size, seed, ...arm.parameters }, worldContext);
    stepPopulation(model, { tick: 1, minutes: study.minutes });
    if (model.minute !== study.minutes || model.tick !== 1) throw new Error('Clock invariant failed');
    rows.push({ caseId: `${size.population}/${size.representedPopulation}`, arm: arm.id, seed,
      config: structuredClone(model.config), worldContext, minute: model.minute,
      ...observe(model, study.sampleSize), clockInvariant: true });
  }
  const metrics = ['personMeanHousingBurden', 'plannedTripMinutes'];
  const groups = study.cases.map(size => {
    const caseId = `${size.population}/${size.representedPopulation}`;
    const selected = rows.filter(r => r.caseId === caseId);
    return { caseId, arms: arms.map(arm => {
      const current = selected.filter(r => r.arm === arm.id);
      return { arm: arm.id, outcomes: Object.fromEntries(metrics.map(metric => [metric, summarize(current.map(r => r.metrics[metric]))])),
        pairedBaselineDelta: Object.fromEntries(metrics.map(metric => [metric, summarize(current.map(r => {
          const a = r.metrics[metric], b = selected.find(b => b.arm === 'baseline' && b.seed === r.seed).metrics[metric];
          return a === null || b === null ? null : a - b;
        }))])), sampleError: Object.fromEntries(['systematic', 'camera'].map(name => [name, summarize(current.map(r => r.samples[name].error))])) };
    }) };
  });
  const comparisons = [];
  for (const kind of ['population-size', 'resolution']) {
    const reference = study.cases.find(c => c.population === c.representedPopulation && c.population === Math.max(...study.cases.map(c => c.population)));
    if (!reference) continue;
    const referenceId = `${reference.population}/${reference.representedPopulation}`;
    for (const size of study.cases.filter(c => c.population !== reference.population && (kind === 'resolution' ? c.representedPopulation === reference.representedPopulation : c.population === c.representedPopulation))) {
      const caseId = `${size.population}/${size.representedPopulation}`;
      for (const arm of arms) for (const metric of metrics) comparisons.push({ kind, caseId, referenceId, arm: arm.id, metric,
        difference: summarize(study.seeds.map(seed => {
          const a = rows.find(r => r.caseId === caseId && r.arm === arm.id && r.seed === seed).metrics[metric];
          const b = rows.find(r => r.caseId === referenceId && r.arm === arm.id && r.seed === seed).metrics[metric];
          return a === null || b === null ? null : a - b;
        })) });
    }
  }
  return { schemaVersion: ENSEMBLE_VERSION, scenarioVersion: 'two-district-capacity-per-represented-person.v1', modelVersion: POPULATION_VERSION,
    study, arms, rows, groups, comparisons,
    units: { personMeanHousingBurden: 'annual rent / annual household income, averaged over people', plannedTripMinutes: 'planned minutes / departed trip', sampleError: 'sample mean minus full person mean burden' },
    interpretation: 'Synthetic CPU model diagnostic. Seed spread is stochastic/generation variation; paired deltas are modeled scenario differences. Resolution comparisons hold represented population and district capacities fixed. Display-sample errors are observed within-model selection errors, not empirical sampling bias.',
    limitations: ['No empirical calibration, forecast coverage or policy causality established.', 'Six default seeds are a compact convenience ensemble; intervals do not quantify all uncertainty.', 'Same seed across sizes does not establish matched resident identities; generation quotas, capacities, demand and weighted economy can change.', 'One day, two synthetic districts, CPU only, render off; no GPU adapter, million-agent or cross-backend claim.', 'Missing travel observations remain null and are excluded with counts; seeds, not people or trips, are the interval replication unit.'] };
}
