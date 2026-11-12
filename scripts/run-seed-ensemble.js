import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { runSeedEnsemble } from '../world/population/seed-ensemble.js';

// Hash the complete relative-import closure, including the actual model rules.
async function sources(url, result = {}) {
  const path = fileURLToPath(url), relative = path.slice(fileURLToPath(new URL('../', import.meta.url)).length);
  if (result[relative]) return result;
  const source = await readFile(url, 'utf8');
  result[relative] = createHash('sha256').update(source).digest('hex');
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) await sources(new URL(match[1], url), result);
  return result;
}
try {
  if (process.argv.length > 3) throw new Error('Usage: bun scripts/run-seed-ensemble.js [study.json]');
  const options = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : {};
  const sourceHashes = await sources(new URL(import.meta.url));
  const start = performance.now();
  const result = runSeedEnsemble(options);
  const elapsedSeconds = (performance.now() - start) / 1000;
  const replayStart = performance.now();
  const replay = runSeedEnsemble(options);
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const replayMatched = digest(result) === digest(replay);
  if (!replayMatched) throw new Error('Deterministic replay mismatch');
  console.log(JSON.stringify({ ...result, evidence: {
    measuredAt: new Date().toISOString(), runtime: { bun: Bun.version },
    machine: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem() },
    backend: 'production Population CPU, sequential, render off', adapterLimits: { maxSeeds: 12, maxCases: 6, maxPeople: 1000, maxRepresented: 1000, maxMinutes: 1440 },
    sourceHashes, elapsedSeconds, replaySeconds: (performance.now() - replayStart) / 1000,
    deterministicDigest: digest(result), replayMatched, runs: result.rows.length,
    timingScope: 'Full model creation, stepping, invariant checks, summaries; excludes replay, source hashing and export. One measurement; not a throughput benchmark.'
  } }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
