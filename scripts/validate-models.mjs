import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runPublishedHousingDiagnostic } from '../world/decision/backtest.js';
import { createEngine } from '../world/city/engine.js';
import { sweep } from './verify-city-seed-replay.mjs';

export function checkAccuracy(result, baseline) {
  const rule = 'housing.houston-stock-error';
  if (result.dataset?.id !== baseline.dataset || result.modelVersion !== baseline.modelVersion || result.seed !== baseline.seed || result.runs !== baseline.runs)
    throw new Error(`${rule}: dataset/model/seed/run contract changed; human review required`);
  const metric = result.metrics?.find(row => row.metricId === baseline.metric);
  if (result.failed !== 0 || result.successful !== baseline.runs || metric?.count !== baseline.runs || metric?.observed !== baseline.observed || !Number.isFinite(metric?.absoluteError))
    throw new Error(`${rule}: incomplete or invalid observations/predictions`);
  if (metric.absoluteError > baseline.absoluteError + baseline.numericTolerance)
    throw new Error(`${rule}: absolute error ${metric.absoluteError} exceeds ${baseline.absoluteError} + ${baseline.numericTolerance} homes`);
  return { rule, passed: true, absoluteError: metric.absoluteError, baseline };
}

export async function validateModels({ diagnostic = runPublishedHousingDiagnostic, replay = sweep } = {}) {
  const baseline = JSON.parse(readFileSync(new URL('../test/fixtures/model-validation/houston.json', import.meta.url)));
  const report = { schemaVersion: 'model-validation.v1', results: [], failures: [] };
  try {
    report.diagnostic = await diagnostic({ seed: baseline.seed, runs: baseline.runs });
    report.results.push(checkAccuracy(report.diagnostic, baseline));
  } catch (error) { report.failures.push({ rule: 'housing.houston-stock-error', message: error.message }); }
  try {
    report.replay = await replay();
    report.cityRules = createEngine().manifest;
    for (const failure of report.replay.mismatches) report.failures.push({ rule: 'city.replay-invariants', ...failure });
    report.results.push({ rule: 'city.replay-invariants', passed: report.replay.mismatches.length === 0, cases: report.replay.caseCount });
  } catch (error) { report.failures.push({ rule: 'city.replay-invariants', message: error.message }); }
  return report;
}
if (import.meta.main) {
  const report = await validateModels({ replay: () => sweep({ onCase: (n, total) => { if (n % 10 === 0 || n === total) console.log(`Replay ${n}/${total}`); } }) });
  report.sourceSHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  report.runtime = Bun.version;
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'world', 'scripts', 'test/fixtures/model-validation'], { encoding: 'utf8' }).trim().split('\n').filter(path => /\.(js|mjs|json)$/.test(path));
  report.sourceHashes = Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
  mkdirSync('test-results/model-validation', { recursive: true });
  writeFileSync('test-results/model-validation/report.json', JSON.stringify(report, null, 2) + '\n');
  for (const row of [...report.results, ...report.failures]) console.log(JSON.stringify(row));
  if (report.failures.length) process.exitCode = 1;
}
