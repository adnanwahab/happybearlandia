import { test, expect } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createState, digest, VERSION } from '../world/bench/million-kernel.js';

async function withReport(run) {
  const dir = await mkdtemp(join(tmpdir(), 'hbl-million-cli-'));
  try { await run(join(dir, 'report.json'), dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}
async function invoke(output, env = {}) {
  const child = Bun.spawn([process.execPath, 'scripts/benchmark-million.js', output, '3', '42'], {
    env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe',
  });
  // Drain both pipes while the process runs.
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr, report: JSON.parse(await readFile(output, 'utf8')) };
}
function provenance(report) {
  expect(report.reviewCandidate).toBe(true);
  expect(report.model).toBe(VERSION);
  expect(report.recipe).toEqual({ sizes: [10000, 100000, 1000000], steps: 3, seed: 42 });
  expect(report.host.platform).toBe(process.platform);
  expect(report.host.arch).toBe(process.arch);
  expect(report.runnerHash).toMatch(/^[a-f0-9]{64}$/);
}

test('CLI exports machine-readable provenance on missing-browser failure', async () => {
  await withReport(async (output, dir) => {
    const { code, report } = await invoke(output, { PLAYWRIGHT_BROWSERS_PATH: join(dir, 'no-browsers') });
    expect(code).toBe(1);
    provenance(report);
    expect(report.status).toBe('failed');
    expect(report.error).toContain("Executable doesn't exist");
    expect(report.records).toEqual([]);
    expect(report.coverage).toHaveLength(9);
    for (const size of report.recipe.sizes) {
      const rows = report.coverage.filter(row => row.size === size);
      expect(rows.map(row => row.phase)).toEqual(['compute-only', 'render-only', 'combined']);
      expect(rows.every(row => row.status === 'unverified' && row.reason)).toBe(true);
    }
  });
});

// Manual browser-capable acceptance gate. Never convert launch failure to a skip.
const browserTest = process.env.HBL_MILLION_BROWSER === '1' ? test : test.skip;
browserTest('real CLI exports all nine size/phase records with replay and metadata', async () => {
  await withReport(async output => {
    const { code, report, stderr } = await invoke(output);
    expect({ code, error: report.error, stderr }).toEqual({ code: 0, error: undefined, stderr: '' });
    provenance(report);
    expect(report.status).toBe('ok');
    expect(report.records).toHaveLength(9);
    expect(report.coverage).toEqual(report.records.map(({ size, phase, status }) => ({ size, phase, status })));
    expect(report.browserVersion).toBeTruthy();
    expect(report.device.userAgent).toContain('Chrome');
    expect(report.device.viewport).toEqual({ width: 800, height: 600, pixelRatio: 1 });
    for (const [path, hash] of Object.entries(report.sourceHashes)) {
      expect(hash).toBe(createHash('sha256').update(await readFile(`world/bench${path}`)).digest('hex'));
    }
    for (const size of report.recipe.sizes) {
      const rows = report.records.filter(row => row.size === size);
      expect(rows.map(row => row.phase)).toEqual(['compute-only', 'render-only', 'combined']);
      expect(rows[0].finalState).toEqual(rows[2].finalState);
      expect(rows[1].finalState).toEqual(digest(createState({ size, steps: 3, seed: 42 })));
      for (const row of rows) {
        expect(row.status).toBe('ok'); expect(row.model).toBe(VERSION); expect(row.seed).toBe(42);
        expect(row.samples).toHaveLength(3);
        expect(row.agentUpdates).toBe(row.samples.reduce((sum, s) => sum + s.agentUpdates, 0));
        expect(row.interactions).toBe(row.samples.reduce((sum, s) => sum + s.interactions, 0));
        expect(row.agentUpdates).toBe(row.phase === 'render-only' ? 0 : size * 3);
        expect(row.interactions).toBe(row.agentUpdates / 2);
        expect(row.renderedPointInstancesPerFrame).toBe(row.phase === 'compute-only' ? 0 : size);
        expect(row.peakMemory.scope).toContain('not process/GPU peak');
        if (row.peakMemory.bytes === null) expect(row.peakMemory.source).toBe('unavailable');
        else { expect(Number.isFinite(row.peakMemory.bytes)).toBe(true); expect(row.peakMemory.bytes).toBeGreaterThan(0); }
        for (const sample of row.samples) {
          if (row.phase === 'render-only') expect(sample.stepMs).toBeNull();
          else { expect(Number.isFinite(sample.stepMs)).toBe(true); expect(sample.stepMs).toBeGreaterThanOrEqual(0); }
          if (row.phase === 'compute-only') expect(sample.frameMs).toBeNull();
          else { expect(Number.isFinite(sample.frameMs)).toBe(true); expect(sample.frameMs).toBeGreaterThanOrEqual(0); }
        }
      }
    }
  });
}, 180000);
