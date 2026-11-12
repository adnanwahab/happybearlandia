// bun scripts/export-demo-evidence-receipt.js [residents<=4096] [ticks<=1000] [seed]
import os from 'node:os';
import { runFixture } from '../world/metrics/agent-counts.js';
import { RECEIPT_SCHEMA, createDemoEvidence } from '../world/metrics/demo-evidence.js';
const args = process.argv.slice(2);
if (args.length > 3) throw new Error('Expected residents, ticks, seed');
const [residents = 128, ticks = 100, seed = 42] = args.map(Number);
const start = performance.now();
const run = runFixture({residents, ticks, seed});
const wallSeconds = (performance.now() - start) / 1000;
const receipt = { schemaVersion: RECEIPT_SCHEMA, run, wallSeconds, measuredAt: new Date().toISOString(),
  machine: { cpu: os.cpus()[0]?.model ?? 'unknown', platform: `${os.platform()} ${os.release()}`, arch: os.arch(), runtime: `Bun ${Bun.version}` },
  command: `bun scripts/export-demo-evidence-receipt.js ${residents} ${ticks} ${seed}` };
createDemoEvidence(receipt);
console.log(JSON.stringify(receipt, null, 2));
