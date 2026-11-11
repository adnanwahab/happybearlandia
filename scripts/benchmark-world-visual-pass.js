// Runs the actual browser journey; timing attachments and traces are in test-results.
import { spawnSync } from 'node:child_process';
import { cpus, platform, release, totalmem } from 'node:os';
console.log(JSON.stringify({ environment: { platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCPUs: cpus().length, memoryBytes: totalmem(), runtime: process.version }, timingPolicy: 'Actual controller durations; unknown worker timings remain null. No speed threshold asserted.' }, null, 2));
const result = spawnSync('bunx', ['playwright', 'test', '--config', 'test/world-visual-pass.browser.config.js', '--grep', 'desktop:'], { stdio: 'inherit', env: process.env });
process.exitCode = result.status ?? 1;
