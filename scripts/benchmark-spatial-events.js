import os from 'node:os';
import { runSpatialEvents } from '../world/spatial-events/model.js';
const sizes = process.argv.slice(2).map(Number);
if (!sizes.length) sizes.push(10000, 100000, 1000000);
const results = [];
for (const count of sizes) for (const hot of [false, true]) {
  const start = performance.now();
  const run = runSpatialEvents({ count, hot });
  results.push({ ...run, elapsedMs: performance.now() - start, memory: process.memoryUsage(), memoryNote: 'post-run process sample; not peak or per-run allocation' });
}
console.log(JSON.stringify({ recordedAt: new Date().toISOString(), runtime: process.version, bun: process.versions.bun, machine: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model, logicalCPUs: os.cpus().length, ramBytes: os.totalmem() }, results }, null, 2));
