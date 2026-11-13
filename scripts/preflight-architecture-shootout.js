// bun scripts/preflight-architecture-shootout.js [uint32 seed]
import os from 'node:os';
import { createShootoutPreflight } from '../world/metrics/architecture-shootout.js';
const args = process.argv.slice(2);
if (args.length > 1) throw Error('Expected at most one uint32 seed');
const report = createShootoutPreflight({ seed: args.length === 0 ? 42 : Number(args[0]) });
console.log(JSON.stringify({ ...report, auditedAt: new Date().toISOString(),
  auditEnvironment: { platform: os.platform(), release: os.release(), arch: os.arch(),
    cpu: os.cpus()[0]?.model ?? null, logicalCPUs: os.cpus().length,
    memoryBytes: os.totalmem(), runtime: process.versions },
}, null, 2));
// A successful export must not look like a successful shootout in automation.
process.exitCode = 2;
