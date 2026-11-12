// bun scripts/benchmark-agent-counts.js [residents<=4096] [ticks<=1000] [uint32 seed]
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { runFixture, exportAgentCounts, interactionClaim } from '../world/metrics/agent-counts.js';
const args = process.argv.slice(2);
if (args.length > 3) throw new Error('Expected residents, ticks, seed');
const [residents = 128, ticks = 100, seed = 42] = args.map(Number);
const start = performance.now();
const run = runFixture({ residents, ticks, seed });
const wallSeconds = (performance.now() - start) / 1000;
// Validation/export cost is deliberately outside the measured fixture execution window.
console.log(JSON.stringify({
  ...exportAgentCounts(run, { wallSeconds }), claim: interactionClaim(run),
  measuredAt: new Date().toISOString(), command: process.argv,
  machine: { hostname: os.hostname(), platform: os.platform(), release: os.release(), arch: os.arch(),
    cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, memoryBytes: os.totalmem(), runtime: process.versions },
  measurement: 'single cold fixture execution; monotonic wall clock; validation/export excluded',
  limitations: ['Synthetic, un-calibrated energy rule; no empirical observations or production engine.',
    'No rendering, GPU, workers or cross-backend equivalence tested.',
    'Bounded microbenchmark includes setup and event allocation; no million-scale throughput claim.'],
}, null, 2));
