// bun scripts/benchmark-million.js [output.json] [steps=30] [seed=42] [sizes=10000,100000,1000000]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { validate } from '../world/bench/million-kernel.js';
const args = process.argv.slice(2);
if (args.length > 4) throw new Error('Expected output, steps, seed, sizes');
const [output = '/private/tmp/hbl-million-benchmark.json', stepText = '30', seedText = '42', sizeText = '10000,100000,1000000'] = args;
const steps = Number(stepText), seed = Number(seedText), sizes = sizeText.split(',').map(Number);
if (!sizes.length || new Set(sizes).size !== sizes.length) throw new Error('Expected unique sizes');
for (const size of sizes) validate({ size, steps, seed });
const sources = {};
for (const name of ['million-kernel.js', 'million-browser.js']) sources[`/${name}`] = await readFile(new URL(`../world/bench/${name}`, import.meta.url), 'utf8');
const report = { schema: 'hbl.headless-million-benchmark.v1', status: 'running', reviewCandidate: true,
  capturedAt: new Date().toISOString(), recipe: { sizes, steps, seed },
  sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, createHash('sha256').update(source).digest('hex')])),
  host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem(), runtime: process.versions },
  limitations: ['Synthetic paired energy transfers, not the production population model or scalar oracle.',
    'Point instances overlap; submitted instances are not distinct visible residents.',
    'Frame time is CPU submission plus gl.finish GPU completion, not presentation time. RAF intervals are separate.',
    'Step time includes changed-ID instrumentation; setup and final digest excluded from wall time.',
    'Memory is sampled JS heap, excludes process/GPU memory and may miss transient peaks; null means unavailable.',
    'Headless software rendering may differ from target hardware. No public performance certification.'], records: [] };
let browser;
try {
  const { chromium } = await import('@playwright/test');
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  for (const size of sizes) for (const phase of ['compute-only', 'render-only', 'combined']) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(120000); const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      // Serve only pinned benchmark bytes through interception; no local server or external network.
      await page.route('**/*', route => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({ status: path === '/' || sources[path] ? 200 : 404,
          contentType: path === '/' ? 'text/html' : 'text/javascript',
          body: sources[path] ?? (path === '/' ? '<!doctype html><title>Opt-in synthetic benchmark</title>' : '') });
      });
      await page.goto('http://hbl-benchmark.invalid/');
      report.device = await page.evaluate(() => ({ userAgent: navigator.userAgent, platform: navigator.platform, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemoryGiB: navigator.deviceMemory ?? null, viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio } }));
      const record = await page.evaluate(async ({ options, phase }) => {
        const { runPhase } = await import('/million-browser.js');
        return await Promise.race([runPhase(options, phase), new Promise((_, reject) => setTimeout(() => reject(new Error('Phase deadline exceeded')), 120000))]);
      }, { options: { size, steps, seed }, phase });
      if (errors.length) throw new Error(errors.join('; '));
      const compute = report.records.find(row => row.size === size && row.phase === 'compute-only');
      if (record.finalState.totalEnergy !== size * 10 || record.samples.length !== steps)
        throw new Error('State invariant or sample count failed');
      if (phase === 'combined' && JSON.stringify(record.finalState) !== JSON.stringify(compute.finalState))
        throw new Error('Seed-matched compute/combined replay mismatch');
      if (record.samples.some(row => [row.stepMs, row.frameMs, row.callbackIntervalMs].some(value => value !== null && (!Number.isFinite(value) || value < 0))))
        throw new Error('Invalid timing sample');
      report.records.push(record);
    } catch (error) { report.records.push({ phase, size, steps, seed, status: 'failed', error: error.message }); throw error; }
    finally { await page.close(); }
  }
  report.status = 'ok';
} catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1; }
finally {
  await browser?.close();
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, output, records: report.records.length, error: report.error }));
}
