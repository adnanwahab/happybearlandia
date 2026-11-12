// Run against a local server: bun scripts/performance/run.js [baseURL] [outputDir]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { budgets, checkBudgets } from './budgets.js';

const [baseURL = 'http://127.0.0.1:3198', directory = 'test-results/performance'] = process.argv.slice(2);
const output = resolve(directory);
await mkdir(output, { recursive: true });
const backends = (process.env.HBL_PERF_BACKENDS || 'webgl2,webgpu').split(',');
if (backends.some(b => !['webgl2', 'webgpu'].includes(b))) throw Error('Unknown backend');
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const scene of Object.keys(budgets)) for (const backend of backends) {
    const id = `${scene}-${backend}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const result = { schemaVersion: 'hbl-performance.v1', scene, backend, browser: browser.version(),
      platform: process.platform, architecture: process.arch, measuredAt: new Date().toISOString(),
      viewport: { width: 1440, height: 900 }, population: 500, quality: 'BALANCED',
      budget: budgets[scene][backend], metrics: {}, errors: [], heapSamples: [] };
    results.push(result);
    page.on('pageerror', error => result.errors.push(error.message));
    let profiling = false;
    try {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.start'); profiling = true;
      await context.tracing.start({ screenshots: true, snapshots: true });
      // Capture transient allocations during navigation as well as the benchmark.
      await cdp.send('Performance.enable');
      const sampleHeap = async () => {
        const { metrics } = await cdp.send('Performance.getMetrics');
        const bytes = metrics.find(m => m.name === 'JSHeapUsedSize')?.value;
        if (Number.isFinite(bytes)) result.heapSamples.push(bytes);
      };
      const started = performance.now();
      result.url = `${baseURL}/world/bench/${scene}?renderer=${backend === 'webgl2' ? 'webgl' : 'webgpu'}&people=500`;
      let done = false, loadError;
      const loading = (async () => {
        await page.goto(result.url, { timeout: 120000 });
        await page.waitForFunction(() => window.hblCityRenderer?.getPerformanceStats().frames > 3, null, { timeout: 120000 });
      })().catch(error => { loadError = error; }).finally(() => { done = true; });
      while (!done) { await sampleHeap(); await new Promise(r => setTimeout(r, 100)); }
      await loading;
      if (loadError) throw loadError;
      result.metrics.loadMs = performance.now() - started;
      const actual = await page.evaluate(() => {
        const api = window.hblCityRenderer;
        api.setAdaptiveQuality(false); api.setQuality('BALANCED');
        return api.getPerformanceStats().backend;
      });
      result.actualBackend = actual;
      if (actual !== backend) throw Error(`Requested ${backend}, observed ${actual}; unsupported backend is not a pass`);
      await page.waitForFunction(() => window.hblCityRenderer.getPerformanceStats().frames > 30);
      await page.evaluate(() => window.hblCityRenderer.startBenchmark({ scripted: true }));
      const deadline = performance.now() + 90000;
      while (performance.now() < deadline) {
        await sampleHeap();
        const report = await page.evaluate(() => window.hblCityRenderer.getPerformanceStats().lastBenchmark);
        if (report) { result.profile = report; break; }
        await new Promise(r => setTimeout(r, 100));
      }
      result.metrics.p95FrameMs = result.profile?.p95FrameMs;
      result.metrics.peakHeapBytes = result.heapSamples.length ? Math.max(...result.heapSamples) : null;
    } catch (error) { result.errors.push(error.stack || String(error)); }
    finally {
      try {
        if (profiling) {
          const { profile } = await cdp.send('Profiler.stop');
          await writeFile(join(output, `${id}.cpuprofile`), JSON.stringify(profile));
        }
        await context.tracing.stop({ path: join(output, `${id}.trace.zip`) });
      } catch (error) { result.errors.push(`Profile persistence failed: ${error.message}`); }
      result.failures = [...result.errors, ...checkBudgets(result.metrics, result.budget)];
      await writeFile(join(output, `${id}.json`), JSON.stringify(result, null, 2));
      await context.close();
      console.log(`${id}: ${result.failures.length ? 'FAIL ' + result.failures.join('; ') : 'PASS'}`);
    }
  }
} finally {
  await writeFile(join(output, 'summary.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.some(r => r.failures.length)) process.exitCode = 1;
