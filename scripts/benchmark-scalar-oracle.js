import { cpus, platform, release, arch } from 'node:os';
import { runOracle, validateRun, MODEL, RULES, LIMITS } from '../world/agent-oracle/scalar.js';

// Optional single JSON recipe argument; stdout is a report, never a fixture writer.
try {
  if (process.argv.length > 3) throw Error('Expected at most one JSON recipe argument');
  const inputs = process.argv[2] ? [JSON.parse(process.argv[2])] : [1000, 10000].map(agents => ({ agents, ticks: 12, seed: 42, stayHomeBps: 2500 }));
  const results = inputs.map(input => {
    const start = performance.now();
    const run = runOracle(input);
    const simulationMs = performance.now() - start;
    const replayStart = performance.now();
    validateRun(run);
    const replayMs = performance.now() - replayStart;
    return { input: run.input, stateHash: run.stateHash, eventHash: run.eventHash, invariants: run.invariants, simulationMs, replayMs };
  });
  console.log(JSON.stringify({ model: MODEL, rules: RULES, adapter: 'headless-scalar-only.v1', limits: LIMITS,
    machine: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, runtime: process.version, bun: process.versions.bun },
    limitations: 'Synthetic uncalibrated CPU reference; no GPU, production adapter, rendering or million-agent throughput evidence.', results }, null, 2));
} catch (error) {
  console.error(`scalar oracle: ${error.message}`);
  process.exitCode = 1;
}
