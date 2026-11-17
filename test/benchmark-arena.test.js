import { test, expect } from 'bun:test';
import { evaluate, compare, SUITE } from '../world/benchmark/arena.js';
import city from '../world/benchmark/city.js';
const suite = { version: 'test.v1', seeds: [0, 1], scenarios: [{ id: 'baseline', months: 1, households: 1 }] };
const fake = { id: 'test-model.v1', rules: ['r1'], source: 'synthetic.v1', run: async (s, seed) => ({ digest: String(seed), metrics: { population: seed + 2 }, counts: { activeAgents: 1, executedStateTransitions: 2, interAgentInteractions: 0, validatedNumericalResults: 1 } }) };
const observation = { suiteVersion: suite.version, scenario: 'baseline', month: 1, seed: 0, metric: 'population', unit: 'people', value: 3, source: 'test observation' };
test('paired reports retain separate counts, aligned accuracy, resources and uncertainty', async () => {
  const a = await evaluate(fake, { suite, observations: [observation] });
  expect(a.stability).toEqual({ attempted: 2, failed: 0, replayMismatches: 0 });
  expect(a.cases[0].counts).toEqual({ activeAgents: 1, executedStateTransitions: 2, interAgentInteractions: 0, validatedNumericalResults: 1 });
  expect(a.cases[0].accuracy[0].absoluteError).toBe(1);
  expect(a.uncertainty[0].metrics.population).toEqual({ lower: 2, upper: 3, width: 1 });
  const b = await evaluate({ ...fake, id: 'test-model.v2' }, { suite, observations: [observation] });
  const comparison = compare([a,b]);
  expect(comparison.columns).toEqual(['test-model.v1','test-model.v2']);
  expect(comparison.rows[0].accuracy.population.mae).toBe(1);
  expect(comparison.rows[0].performance[0].durationMs).toBeGreaterThanOrEqual(0);
  expect(() => compare([a, { ...b, suiteHash: 'other' }])).toThrow('Incompatible');
  expect(() => compare([a, { ...b, observationsHash: 'other' }])).toThrow('Incompatible');
});
test('missing observed history stays unavailable and partial ensembles have no band', async () => {
  const report = await evaluate({ ...fake, run: async (s, seed) => { if (seed) throw new Error('failure'); return fake.run(s, seed); } }, { suite });
  expect(report.stability.failed).toBe(1);
  expect(report.cases[1].error).toBe('failure');
  expect(report.uncertainty[0].metrics).toBeNull();
  expect(compare([report]).rows[0].accuracy).toBeNull();
});
test('replay disagreement and corrupt numeric/count outputs fail independently', async () => {
  let n = 0;
  const mismatch = await evaluate({ ...fake, run: async (s,seed) => ({ ...await fake.run(s,seed), digest: String(n++) }) }, { suite });
  expect(mismatch.stability.replayMismatches).toBe(2);
  for (const result of [{ metrics: { population: NaN } }, { counts: { activeAgents: 10 } }]) {
    const report = await evaluate({ ...fake, run: async (s,seed) => ({ ...await fake.run(s,seed), ...result }) }, { suite });
    expect(report.stability.failed).toBe(2);
  }
});
test('observations reject wrong time, seed, source and duplicate alignment', async () => {
  for (const change of [{month:2},{seed:5},{source:''},{value:Infinity},{suiteVersion:'wrong'}]) {
    await expect(evaluate(fake, { suite, observations: [{...observation,...change}] })).rejects.toThrow('Invalid observed');
  }
  await expect(evaluate(fake, { suite, observations: [observation,observation] })).rejects.toThrow('Duplicate');
});
test('real city uses standard scenario authority, independent replay and unavailable interactions', async () => {
  const report = await evaluate(city, { suite: { ...SUITE, seeds: [42] } });
  expect(report.stability.failed).toBe(0);
  expect(report.stability.replayMismatches).toBe(0);
  for (const row of report.cases) {
    expect(row.counts.interAgentInteractions).toBeNull();
    expect(row.counts.activeAgents).toBeGreaterThan(0);
    expect(row.counts.executedStateTransitions).toBeGreaterThanOrEqual(row.counts.activeAgents);
    expect(row.counts.validatedNumericalResults).toBe(Object.keys(row.metrics).length);
  }
}, 30000);

test('CLI persists independent reports and compares them after restart', async () => {
  const { mkdtemp, readdir, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'arena-test-'));
  try {
    for (let i = 0; i < 2; i++) {
      const run = Bun.spawn([process.execPath, 'scripts/benchmark-arena.js', 'run', directory], { stdout: 'pipe', stderr: 'pipe' });
      expect(await run.exited).toBe(0);
    }
    const paths = (await readdir(directory)).map(name => join(directory,name));
    expect(paths).toHaveLength(2);
    const stored = JSON.parse(await readFile(paths[0], 'utf8'));
    expect(stored.cases).toHaveLength(20);
    expect(stored.sourceHashes['world/city/engine.js']).toHaveLength(64);
    const comparison = Bun.spawn([process.execPath, 'scripts/benchmark-arena.js', 'compare', ...paths], { stdout: 'pipe', stderr: 'pipe' });
    const text = await new Response(comparison.stdout).text();
    expect(await comparison.exited).toBe(0);
    expect(JSON.parse(text).columns).toHaveLength(2);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);
