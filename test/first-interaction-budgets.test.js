import { test, expect } from 'bun:test';
import { chooseLimits, assertLimits, limitsFromReport } from '../scripts/performance/first-interaction-budgets.mjs';
import config from './performance/first-interaction-budgets.json';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const samples = [100, 80, 120].map(n => ({jsBytes:n,readyMs:n,renderMs:n,peakHeapBytes:n}));
test('selects the worst cold sample with explicit headroom', () => {
  const limits = chooseLimits(samples);
  expect(limits).toEqual({ jsBytes:150,readyMs:150,renderMs:150,peakHeapBytes:150 });
  expect(() => assertLimits(limits)).not.toThrow();
});
// Contract fixtures only; these values are not measured performance evidence.
function report(profile) {
  return {
    schemaVersion: 'hbl.first-interaction.v1', status: 'passed', profile,
    commit: 'fixture-revision', browser: { version: 'fixture-browser' }, host: { cpu: 'fixture-cpu' },
    samples: samples.map((sample, run) => ({ ...sample, run, evidence: {
      seed: 42, month: 16, modelVersion: 'fixture-model', initialHash: 'fixture-hash', backend: 'webgl',
    } })),
  };
}
test('only complete, passed, profile-matched reports can calibrate limits', () => {
  for (const profile of config.profiles) {
    const valid = report(profile);
    expect(limitsFromReport(valid, profile, config.runs)).toEqual(chooseLimits(samples));
    for (const mutate of [
      r => { delete r.status; },
      r => { r.status = 'incomplete'; },
      r => { r.schemaVersion = 'unknown'; },
      r => { r.profile.cpuSlowdown += 1; },
      r => { r.samples.pop(); },
      r => { r.samples.push(r.samples[0]); },
      r => { delete r.commit; },
      r => { delete r.browser.version; },
      r => { delete r.host.cpu; },
      r => { r.samples[1].run = 0; },
      r => { r.samples[1].evidence.seed = 43; },
      r => { r.samples[1].evidence.month = 0; },
      r => { r.samples[1].evidence.backend = 'inventory-fallback'; },
      r => { delete r.samples[1].evidence.initialHash; },
      r => { r.samples[1].evidence.modelVersion = 'different'; },
      r => { r.samples[1].peakHeapBytes = null; },
    ]) {
      const invalid = structuredClone(valid);
      mutate(invalid);
      expect(() => limitsFromReport(invalid, profile, config.runs)).toThrow();
    }
  }
});
test('missing samples or metrics cannot produce passing budgets', () => {
  expect(() => chooseLimits(samples.slice(1))).toThrow();
  for (const value of [undefined, null, NaN, Infinity, 0, -1]) {
    expect(() => chooseLimits([...samples.slice(1), {...samples[0], peakHeapBytes:value}])).toThrow();
  }
  expect(() => assertLimits({})).toThrow('Uncalibrated');
});
test('calibration CLI writes a complete proposal and fails without one on incomplete evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'hbl-calibration-fixture-'));
  const output = join(root, 'test-results/first-interaction');
  const proposal = join(output, 'budget-proposal.json');
  const command = fileURLToPath(new URL('../scripts/performance/calibrate-first-interaction.mjs', import.meta.url));
  try {
    mkdirSync(join(root, 'test/performance'), { recursive: true });
    writeFileSync(join(root, 'test/performance/first-interaction-budgets.json'), JSON.stringify(config));
    for (const profile of config.profiles) {
      mkdirSync(join(output, profile.id), { recursive: true });
      writeFileSync(join(output, profile.id, 'measurement.json'), JSON.stringify(report(profile)));
    }
    expect(spawnSync(process.execPath, [command], { cwd: root }).status).toBe(0);
    const result = JSON.parse(readFileSync(proposal, 'utf8'));
    expect(result.status).toBe('measured-proposal-awaiting-review');
    expect(result.profiles.map(p => p.limits)).toEqual(config.profiles.map(() => chooseLimits(samples)));
    rmSync(proposal);
    const incomplete = report(config.profiles[0]);
    incomplete.status = 'incomplete';
    writeFileSync(join(output, config.profiles[0].id, 'measurement.json'), JSON.stringify(incomplete));
    expect(spawnSync(process.execPath, [command], { cwd: root }).status).not.toBe(0);
    expect(existsSync(proposal)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
