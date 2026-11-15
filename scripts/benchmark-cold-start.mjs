// bun scripts/benchmark-cold-start.mjs [baseURL] [output.json]
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import os from 'node:os';

export function metric(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}
export function buildReport(raw = {}) {
  const timing = raw.timing || {};
  return {
    ...raw,
    schemaVersion: 'hbl-cold-start.v1',
    timing: Object.fromEntries(['appReadyMs', 'firstUsefulRenderMs', 'firstActionableControlMs', ...(raw.requestedBackend === 'canvas2d' ? ['firstCanvasReadyFrameProxyMs'] : [])].map(key => [key, metric(timing[key])])),
    renderObservation: raw.requestedBackend === 'canvas2d' ? 'Canvas readiness proxy: two animation frames after initialized Canvas2D; not a 3D milestone or presentation timestamp' : '3D placeholder/frame hook followed by an animation-frame observation; not GPU presentation',
    memory: { usedJSHeapBytes: metric(raw.memory?.usedJSHeapBytes), scope: 'Chromium performance.memory JS heap only; excludes GPU and total process memory' },
    selectedBackend: raw.selectedBackend || null,
    graphicsExecution: /swiftshader|llvmpipe|software/i.test(raw.graphicsRenderer || '') ? 'software' : raw.graphicsRenderer ? 'reported renderer; hardware acceleration unverified' : 'unknown',
    errors: raw.errors || [],
  };
}

// Runs in the page before application modules. All clocks use navigation time origin.
export function observeStartup() {
  const probe = window.__hblColdStart = { timing: {}, control: '#top > summary', startup: null };
  function sample() {
    const startup = window.hblWorldStartup;
    probe.startup = startup ? { ...startup } : null;
    if (startup?.readyMs != null) probe.timing.appReadyMs = startup.readyMs;
    // Placeholders are meaningful city geometry; the initial empty frame is not.
    // Observe on a subsequent animation frame, an upper bound on submission, not GPU presentation.
    if (startup?.placeholdersReadyMs != null && startup?.firstFrameMs != null && probe.timing.firstUsefulRenderMs == null) {
      requestAnimationFrame(() => { probe.timing.firstUsefulRenderMs ??= performance.now(); });
    }
    if (startup?.mode === 'canvas2d' && startup.readyMs != null && probe.timing.firstCanvasReadyFrameProxyMs == null) {
      const canvas = document.querySelector('#canvas-lite-world');
      const bounds = canvas?.getBoundingClientRect();
      if (bounds?.width > 0 && bounds?.height > 0 && canvas.getContext('2d')) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          probe.timing.firstCanvasReadyFrameProxyMs ??= performance.now();
        }));
      }
    }
    const control = document.querySelector(probe.control);
    const rect = control?.getBoundingClientRect();
    if (startup?.readyMs != null && control && !control.disabled && control.getAttribute('aria-disabled') !== 'true' && rect.width > 0 && rect.height > 0 && getComputedStyle(control).visibility !== 'hidden') {
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (hit && (hit === control || control.contains(hit))) probe.timing.firstActionableControlMs ??= performance.now();
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}

export function reportFailures(row) {
  const failures = [...row.errors];
  const required = ['appReadyMs', 'firstActionableControlMs', row.requestedBackend === 'canvas2d' ? 'firstCanvasReadyFrameProxyMs' : 'firstUsefulRenderMs'];
  if (required.some(key => metric(row.timing[key]) === null)) failures.push('Incomplete startup milestones');
  if (!row.selectedBackend) failures.push('Selected backend unavailable');
  else if (row.selectedBackend !== (row.requestedBackend === 'webgl' ? 'webgl2' : row.requestedBackend)) failures.push(`Requested ${row.requestedBackend}, selected ${row.selectedBackend}; requested path not measured`);
  return failures;
}

export async function run(base = 'http://127.0.0.1:3000', output = '/tmp/hbl-cold-start.json', dependencies = {}) {
  const { chromium } = dependencies.chromium ? dependencies : await import('@playwright/test');
  const reports = [];
  const requestedBackends = process.env.HBL_COLD_START_WEBGPU === '1' ? ['webgpu', 'webgl', 'canvas2d'] : ['webgl', 'canvas2d'];
  // Fresh browser per path: no shared HTTP cache, cookies, storage or warmed renderer.
  for (const requestedBackend of requestedBackends) {
    const errors = [];
    let browser;
    let raw = {};
    const url = new URL('/world?demo=1&people=30&living=0&seed=42&quality=LOW', base);
    url.searchParams.set('renderer', requestedBackend);
    if (requestedBackend === 'webgpu') url.searchParams.delete('living'); // Native renderer entry; demo still pins the same legacy town.
    try {
      browser = await chromium.launch({ headless: process.env.HEADED !== '1', ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      await context.addInitScript(observeStartup);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
      if (!response?.ok()) errors.push(`Navigation HTTP ${response?.status() ?? 'unavailable'}`);
      try {
        await page.waitForFunction(() => {
          const probe = window.__hblColdStart;
          const renderKey = probe.startup?.mode === 'canvas2d' ? 'firstCanvasReadyFrameProxyMs' : 'firstUsefulRenderMs';
          return ['appReadyMs', 'firstActionableControlMs', renderKey].every(key => Number.isFinite(probe.timing[key]));
        }, null, { timeout: 120000 });
      } catch (error) { errors.push(error.message); }
      raw = await page.evaluate(() => {
        const canvas = document.querySelector('#view canvas');
        const gl = canvas?.getContext('webgl2');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        return { ...window.__hblColdStart, selectedBackend: window.hblCityRenderer?.getPerformanceStats().backend ?? (window.hblWorldStartup?.mode === 'canvas2d' && document.querySelector('#canvas-lite-world')?.getContext('2d') ? 'canvas2d' : null),
          graphicsRenderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
          canvasPixelEvidence: window.hblWorldStartup?.mode === 'canvas2d' ? (() => {
            const ctx = canvas?.getContext('2d');
            if (!ctx || !canvas.width || !canvas.height) return null;
            const colors = new Set(); let opaqueSamples = 0;
            for (let y = 1; y <= 12; y++) for (let x = 1; x <= 12; x++) {
              const rgba = [...ctx.getImageData(Math.floor(canvas.width*x/13), Math.floor(canvas.height*y/13), 1, 1).data];
              colors.add(rgba.join(',')); if (rgba[3]) opaqueSamples++;
            }
            return { width:canvas.width, height:canvas.height, sampleCount:144, uniqueSampleColors:colors.size, opaqueSamples };
          })() : null,
          memory: { usedJSHeapBytes: performance.memory?.usedJSHeapSize ?? null },
          userAgent: navigator.userAgent, sourceLabel: document.querySelector('#source')?.textContent ?? null,
          timeOrigin: performance.timeOrigin, sampledAtMs: performance.now() };
      });
      raw.browserVersion = browser.version();
      if (process.env.HBL_COLD_START_SCREENSHOTS === '1') await page.screenshot({ path: output.replace(/\.json$/, '') + '-' + requestedBackend + '.png' });
    } catch (error) { errors.push(error.message); }
    finally {
      try { await browser?.close(); } catch (error) { errors.push(`Browser cleanup: ${error.message}`); }
    }
    const row = buildReport({ ...raw, requestedBackend, url: url.href, errors });
    row.validationErrors = reportFailures(row);
    reports.push(row);
  }
  const report = { schemaVersion: 'hbl-cold-start-suite.v1', measuredAt: new Date().toISOString(),
    host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, totalMemoryBytes: os.totalmem() },
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, nativeWebGPU: requestedBackends.includes('webgpu') ? 'Explicitly requested; actual selected backend and any fallback are recorded per path.' : 'not measured; requested paths are WebGL and Canvas2D',
    actionableControl: 'Native World controls disclosure (#top > summary), sampled only after app readiness; no simulation is started.',
    cache: 'fresh browser/context per path; OS, server and disk caches not cleared', reports };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await run(...process.argv.slice(2));
  if (report.reports.some(row => reportFailures(row).length)) process.exitCode = 1;
}
