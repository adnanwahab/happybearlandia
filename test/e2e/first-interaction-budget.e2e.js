import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { hostname, platform, arch, cpus } from 'node:os';
import { assertLimits } from '../../scripts/performance/first-interaction-budgets.mjs';
import budgets from '../performance/first-interaction-budgets.json' with { type: 'json' };

// These are laboratory emulations, never physical laptop/phone certification.
for (const profile of budgets.profiles) {
  test(`${profile.id}: homepage to first demo interaction`, async ({ browser }, info) => {
    if (!process.env.HBL_PERF_CALIBRATE) assertLimits(profile.limits);
    const samples = [];
    const report = {
      schemaVersion: 'hbl.first-interaction.v1', timestamp: new Date().toISOString(),
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      host: { hostname: hostname(), platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
      browser: { name: 'chromium', version: browser.version() }, profile,
      physicalHardwareTested: false, route: '/ → /world/future-machine.html?demo=1',
      limitations: ['CPU/network/viewport emulation only; no physical device claim.',
        'Peak is sampled main-page V8 used heap, excluding workers, GPU, native and process memory.',
        'Render latency ends after two animation frames; it does not prove display scanout.',
        'Decoded JS response bytes include homepage frames and demo, not compressed transfer bytes.'],
      status: 'incomplete', samples,
    };
    try {
      for (let run = 0; run < budgets.runs; run++) {
        const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor });
        try {
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false, latency: profile.network.latencyMs,
            downloadThroughput: profile.network.downloadBytesPerSecond,
            uploadThroughput: profile.network.uploadBytesPerSecond,
          });
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown });
          await cdp.send('Performance.enable');
          let peakHeapBytes = 0;
          const heap = async () => {
            const { metrics } = await cdp.send('Performance.getMetrics');
            peakHeapBytes = Math.max(peakHeapBytes, metrics.find(m => m.name === 'JSHeapUsedSize')?.value ?? 0);
          };
          let samplingError;
          const timer = setInterval(() => { heap().catch(error => { samplingError = error; }); }, 50);
          let jsBytes = 0;
          const pending = [];
          page.on('response', response => {
            if (response.request().resourceType() === 'script') {
              pending.push(response.body().then(body => { jsBytes += body.length; }));
            }
          });
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const started = performance.now();
          try {
            await page.goto('/');
            await page.getByRole('link', { name: 'Play Demo', exact: true }).click();
            await expect.poll(() => page.evaluate(() => window.futureMachine?.state.status), { timeout: 90000 }).toBe('ready');
            await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
            const slider = page.getByRole('slider').first();
            await expect(slider).toBeEnabled();
            const readyMs = performance.now() - started;
            const renderMs = await page.evaluate(async () => {
              const slider = document.querySelector('input[type="range"]');
              const start = performance.now();
              slider.value = '16';
              slider.dispatchEvent(new Event('input', { bubbles: true }));
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              if (window.futureMachine.state.month !== 16) throw new Error('Interaction did not update month');
              return performance.now() - start;
            });
            await heap();
            const evidence = await page.evaluate(() => ({ seed: futureMachine.history.seed,
              modelVersion: futureMachine.history.modelVersion, initialHash: futureMachine.history.initialHash,
              backend: futureMachine.stats.scene.backend, month: futureMachine.state.month }));
            await Promise.all(pending);
            if (samplingError) throw samplingError;
            expect(errors).toEqual([]);
            expect(evidence.seed).toBe(42);
            expect(typeof evidence.backend).toBe('string');
            expect(evidence.backend).not.toBe('inventory-fallback');
            expect(peakHeapBytes).toBeGreaterThan(0);
            samples.push({ run, jsBytes, readyMs, renderMs, peakHeapBytes, evidence });
          } finally { clearInterval(timer); }
        } finally { await context.close(); }
      }
      report.observedMax = Object.fromEntries(['jsBytes', 'readyMs', 'renderMs', 'peakHeapBytes']
        .map(key => [key, Math.max(...samples.map(sample => sample[key]))]));
      if (!process.env.HBL_PERF_CALIBRATE) {
        for (const [key, limit] of Object.entries(profile.limits)) {
          expect(report.observedMax[key], `${profile.id} ${key}`).toBeLessThanOrEqual(limit);
        }
      }
      report.status = 'passed';
    } finally {
      await writeFile(info.outputPath('measurement.json'), JSON.stringify(report, null, 2));
      await info.attach('measurement', { path: info.outputPath('measurement.json'), contentType: 'application/json' });
    }
  });
}
