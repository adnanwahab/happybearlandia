import { test, expect } from 'bun:test';
import { reviewSoak } from '../scripts/soak-evidence.js';

// Synthetic contract fixtures, never device measurements.
function fixture(tier = 'T2') {
  const metric = () => ({ value: null, unavailableReason: 'Synthetic fixture; no device API' });
  return { schemaVersion: 1, tier, device: 'synthetic', os: 'synthetic', browser: 'synthetic',
    capturedAt: '2026-11-12T00:00:00Z', sourceCommit: 'fixture', modelVersion: 'fixture-v1',
    rulesVersion: 'fixture-v1', scenario: 'synthetic contract only', fallback: 'reduce population and rerun',
    seed: 42, population: 1000000, webgpuAvailable: false,
    runs: ['off', 'on'].map(rendering => ({ rendering, workerSimulation: true, evidence: 'synthetic:test',
      oom: false, crashes: 0, reloads: 0,
      minutes: Array.from({ length: 20 }, (_, i) => ({ minute: i + 1, wallSeconds: 60, modeledDays: i === 19 ? 48 : 60 })),
      frameP50Ms: metric(), frameP95Ms: metric(), memoryHighWaterBytes: metric(), longTasks: metric(),
      batteryDropPercentagePoints: metric(),
      background: { hiddenAtSeconds: 600, restoredAtSeconds: 660, behavior: 'fixture', evidence: 'synthetic:test' },
    })) };
}

test('inclusive proposed T2 80% boundary, per rendering mode', () => {
  const r = fixture();
  expect(reviewSoak(r).outcomes.map(o => o.proposedGate)).toEqual(['pass', 'pass']);
  r.runs[1].minutes[19].modeledDays = 47;
  expect(reviewSoak(r).outcomes.map(o => o.proposedGate)).toEqual(['pass', 'fail']);
});
test('rates use measured wall time and zero baseline is unavailable', () => {
  const r = fixture();
  r.runs[0].minutes[19].wallSeconds = 120;
  expect(reviewSoak(r).outcomes[0].retention).toBe(0.4);
  r.runs[0].minutes[0].modeledDays = 0;
  expect(reviewSoak(r).outcomes[0].proposedGate).toBe('unavailable');
});
test('mobile OOM fails while missing observation invalidates report', () => {
  for (const tier of ['T3', 'T4']) {
    const r = fixture(tier);
    r.runs[0].oom = true;
    expect(reviewSoak(r).outcomes[0].proposedGate).toBe('fail');
    delete r.runs[0].oom;
    expect(reviewSoak(r).valid).toBe(false);
  }
});
test('reject incomplete, duplicate, reordered and invalid evidence', () => {
  const mutations = [
    r => r.runs.pop(), r => r.runs[1].rendering = 'off',
    r => r.runs[0].minutes.pop(), r => r.runs[0].minutes[3].minute = 1,
    r => r.runs[0].minutes[0].modeledDays = Infinity,
    r => r.runs[0].workerSimulation = false, r => r.seed = -1,
    r => r.runs[0].batteryDropPercentagePoints = { value: null },
    r => r.runs[0].background.restoredAtSeconds = 500,
    r => { r.runs[0].frameP50Ms = { value: 20 }; r.runs[0].frameP95Ms = { value: 10 }; },
  ];
  for (const mutate of mutations) {
    const r = fixture(); mutate(r);
    expect(reviewSoak(r).valid).toBe(false);
    expect(reviewSoak(r).outcomes).toEqual([]);
  }
  for (const r of [null, {}, { runs: {} }]) expect(reviewSoak(r).valid).toBe(false);
});
test('CLI rejects malformed report with nonzero exit and machine-readable errors', async () => {
  const dir = await import('node:fs/promises').then(fs => fs.mkdtemp('/tmp/hbl-soak-'));
  const fs = await import('node:fs/promises');
  try {
    await fs.writeFile(`${dir}/report.json`, '{}');
    const proc = Bun.spawn([process.execPath, 'scripts/soak-evidence.js', `${dir}/report.json`], { stdout: 'pipe', stderr: 'pipe' });
    const output = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(1);
    expect(JSON.parse(output).valid).toBe(false);
  } finally { await fs.rm(dir, { recursive: true }); }
});
