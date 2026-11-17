import { stateHash } from '../future-machine/data/core.js';

export const SUITE = {
  version: 'city-arena.v1', seeds: [0, 1, 42, 2147483648, 4294967295],
  scenarios: [
    { id: 'baseline', households: 30, months: 12 },
    { id: 'housing', households: 30, months: 12, intervention: { type: 'housing', districtId: 'd1', amount: 12, cost: 1000000, delay: 2 } },
    { id: 'flood', households: 30, months: 12, shock: { type: 'flood', districtId: 'd1', start: 2, duration: 3, severity: 0.7 } },
    { id: 'minimum', households: 1, months: 12 },
  ],
};
const finite = value => typeof value === 'number' && Number.isFinite(value);
function validateResult(result) {
  if (!result || typeof result.digest !== 'string' || !result.digest || !result.metrics || !Object.keys(result.metrics).length || !Object.values(result.metrics).every(finite)) throw new Error('Invalid adapter result');
  for (const key of ['activeAgents', 'executedStateTransitions', 'interAgentInteractions', 'validatedNumericalResults']) {
    const n = result.counts?.[key];
    if (n === null && key === 'interAgentInteractions') continue;
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Invalid count: ${key}`);
  }
}
export async function evaluate(adapter, { suite = SUITE, observations = [], clock = () => performance.now(), memory = () => process.memoryUsage().rss } = {}) {
  if (!adapter.id || !adapter.rules || !adapter.source || typeof adapter.run !== 'function') throw new Error('Invalid model adapter');
  if (!suite.version || !Array.isArray(suite.seeds) || suite.seeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) || !suite.seeds.length || new Set(suite.seeds).size !== suite.seeds.length || !suite.scenarios.length || new Set(suite.scenarios.map(s => s.id)).size !== suite.scenarios.length) throw new Error('Invalid suite');
  for (const row of observations) {
    if (row.suiteVersion !== suite.version || !suite.scenarios.some(s => s.id === row.scenario && s.months === row.month) || !suite.seeds.includes(row.seed) || !row.source || !row.metric || !row.unit || !finite(row.value)) throw new Error('Invalid observed history alignment/provenance');
  }
  if (new Set(observations.map(r => JSON.stringify([r.scenario,r.seed,r.metric]))).size !== observations.length) throw new Error('Duplicate observed history');
  for (const row of observations) {
    if (observations.some(other => other.metric === row.metric && other.unit !== row.unit)) throw new Error('Inconsistent observed metric units');
  }
  const cases = [];
  let metricKeys;
  for (const scenario of suite.scenarios) for (const seed of suite.seeds) {
    const entry = { scenario: scenario.id, seed };
    cases.push(entry);
    try {
      const rssBefore = memory(), start = clock();
      const actual = await adapter.run(structuredClone(scenario), seed);
      const durationMs = clock() - start, rssAfter = memory();
      validateResult(actual);
      const keys = Object.keys(actual.metrics).sort().join(',');
      if (metricKeys && keys !== metricKeys) throw new Error('Incompatible metric schema');
      metricKeys = keys;
      if (![durationMs, rssBefore, rssAfter].every(finite) || durationMs < 0 || rssBefore < 0 || rssAfter < 0) throw new Error('Invalid resource measurement');
      Object.assign(entry, { ...actual, performance: { durationMs, rssBefore, rssAfter, rssDeltaBytes: rssAfter - rssBefore } });
      const replay = await adapter.run(structuredClone(scenario), seed);
      validateResult(replay);
      entry.replay = await stateHash(actual) === await stateHash(replay);
      entry.accuracy = observations.filter(r => r.scenario === scenario.id && r.seed === seed).map(row => {
        if (!finite(actual.metrics[row.metric])) throw new Error(`Observed metric unsupported: ${row.metric}`);
        const absoluteError = Math.abs(actual.metrics[row.metric] - row.value);
        if (!finite(absoluteError)) throw new Error('Nonfinite accuracy error');
        return { ...row, predicted: actual.metrics[row.metric], absoluteError };
      });
    } catch (error) { entry.error = error.message; }
  }
  const uncertainty = suite.scenarios.map(scenario => {
    const runs = cases.filter(c => c.scenario === scenario.id && !c.error);
    const complete = runs.length === suite.seeds.length;
    const keys = runs.length ? Object.keys(runs[0].metrics) : [];
    return { scenario: scenario.id, samples: runs.length, expectedSamples: suite.seeds.length,
      method: 'empirical seed range (min–max), not a calibrated confidence interval',
      metrics: complete ? Object.fromEntries(keys.map(key => {
        const values = runs.map(r => r.metrics[key]);
        if (!values.every(finite)) throw new Error('Incompatible metric schemas');
        const lower = Math.min(...values), upper = Math.max(...values);
        const width = upper - lower;
        return [key, { lower, upper, width: finite(width) ? width : null, ...(finite(width) ? {} : { unavailable: 'Numerical range overflow' }) }];
      })) : null };
  });
  return { schemaVersion: 'simulation-arena.v1', modelVersion: adapter.id, rules: adapter.rules, source: adapter.source,
    suite: structuredClone(suite), suiteHash: await stateHash(suite), observations, observationsHash: await stateHash(observations), cases, uncertainty,
    stability: { attempted: cases.length, failed: cases.filter(c => c.error).length, replayMismatches: cases.filter(c => c.replay === false).length },
    limitations: ['Synthetic uncalibrated City scenarios; observed history must be explicitly supplied and aligned.', 'RSS is process resident memory sampled before/after, not peak or isolated model memory. Timing includes setup, validation and digest; replay is excluded.', 'Active agents are changed household/worker/business records; transitions are monthly committed row changes including births, excluding deletions and within-step changes. Pairwise interactions are unsupported (null).', 'Validated numerical results count finite terminal metric values after engine invariant validation, not empirical validation.'] };
}
export function compare(reports) {
  if (!reports.length) throw new Error('No reports');
  if (reports.some(r => r.suiteHash !== reports[0].suiteHash || r.observationsHash !== reports[0].observationsHash)) throw new Error('Incompatible suite or observed history');
  const columns = reports.map(r => `${r.modelVersion}`);
  const rows = reports.map(r => {
    const errors = r.cases.flatMap(c => c.error ? [] : (c.accuracy || []));
    return { model: r.modelVersion, failed: r.stability.failed, replayMismatches: r.stability.replayMismatches,
      accuracy: errors.length ? Object.fromEntries([...new Set(errors.map(e => e.metric))].map(metric => {
        const values = errors.filter(e => e.metric === metric); return [metric, { unit: values[0].unit, samples: values.length, mae: values.reduce((s,e) => s + e.absoluteError / values.length,0) }];
      })) : null,
      counts: r.cases.map(c => ({ scenario: c.scenario, seed: c.seed, counts: c.counts ?? null })),
      performance: r.cases.map(c => ({ scenario: c.scenario, seed: c.seed, ...c.performance })), uncertainty: r.uncertainty };
  });
  return { columns, rows };
}
