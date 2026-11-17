import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { evaluate, compare } from '../world/benchmark/arena.js';
import city from '../world/benchmark/city.js';

const [command = 'run', ...args] = process.argv.slice(2);
if (command === 'compare') {
  const reports = await Promise.all(args.map(path => readFile(path, 'utf8').then(JSON.parse)));
  const comparison = compare(reports);
  console.log(JSON.stringify(comparison, null, 2));
  // Compact side-by-side view; details and per-scenario bands remain in JSON.
  console.error(['Measure', ...comparison.columns].join('\t'));
  for (const [label, fn] of [
    ['Failed cases', r => r.failed], ['Replay mismatches', r => r.replayMismatches],
    ['Accuracy MAE (per metric)', r => JSON.stringify(r.accuracy)],
    ['Execution ms (sum)', r => r.performance.some(c => c.durationMs !== undefined) ? r.performance.reduce((sum,c) => sum + (c.durationMs || 0),0) : null],
    ['RSS after bytes (max)', r => r.performance.some(c => c.rssAfter !== undefined) ? Math.max(...r.performance.map(c => c.rssAfter || 0)) : null],
  ]) console.error([label, ...comparison.rows.map(fn)].join('\t'));
} else if (command === 'run') {
  const directory = resolve(args[0] || '.hbl-benchmarks');
  const observations = args[1] && args[1] !== '-' ? JSON.parse(await readFile(args[1], 'utf8')) : [];
  const adapterPaths = args.slice(2).length ? args.slice(2) : ['world/benchmark/city.js'];
  const sourcePaths = [...new Set(['world/benchmark/arena.js', 'world/benchmark/city.js', 'scripts/benchmark-arena.js', 'world/city/engine.js', 'world/city/contracts.js', 'world/city/seed.js', 'world/city/systems.js', 'world/future-machine/data/core.js', ...adapterPaths])];
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
  const adapters = args.slice(2).length ? await Promise.all(args.slice(2).map(async path => (await import(pathToFileURL(resolve(path)).href)).default)) : [city];
  if (new Set(adapters.map(a => a.id)).size !== adapters.length) throw new Error('Duplicate model versions');
  await mkdir(directory, { recursive: true });
  for (const adapter of adapters) {
    const report = await evaluate(adapter, { observations });
    Object.assign(report, { createdAt: new Date().toISOString(), sourceHashes, runtime: { bun: Bun.version, platform: process.platform, arch: process.arch } });
    const path = resolve(directory, `${randomUUID()}.json`);
    await writeFile(`${path}.tmp`, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await rename(`${path}.tmp`, path);
    console.log(path);
    if (report.stability.failed || report.stability.replayMismatches) process.exitCode = 1;
  }
} else throw new Error('Use run [directory] [observations.json|-] [adapter.js ...] or compare report.json ...');
