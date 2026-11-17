import { test, expect } from 'bun:test';
import { runOracle, validateRun, assertState, normalizeInput, MODEL, RULES } from '../world/agent-oracle/scalar.js';
import golden from './fixtures/scalar-agent-oracle/golden.json';

for (const fixture of golden.cases) test(`golden repeat/replay ${fixture.input.agents} agents`, () => {
  expect(golden.schemaVersion).toBe('scalar-agent-oracle-golden.v1');
  expect(golden.model).toBe(MODEL); expect(golden.rules).toBe(RULES);
  const a = runOracle(fixture.input), b = runOracle(fixture.input);
  expect({ input: a.input, stateHash: a.stateHash, eventHash: a.eventHash, invariants: a.invariants }).toEqual(fixture);
  expect(b).toEqual(a);
  expect(validateRun(JSON.parse(JSON.stringify(a)))).toEqual(a.final);
});

test('integer bounds, empty population, singleton, partial household, zero horizon and seed endpoints', () => {
  for (const agents of [0, 1, 3, 4, 5]) for (const seed of [0, 0xffffffff]) for (const ticks of [0, 32]) {
    const run = runOracle({ agents, seed, ticks });
    expect(validateRun(run)).toEqual(run.final);
    expect(run.final.length).toBe(agents);
    expect(run.invariants.households).toBe(Math.ceil(agents / 4));
    if (!agents || !ticks) expect(run.events).toEqual([]);
  }
});

test('policy-matched draws and contact conservation with explicit causal dependencies', () => {
  const control = runOracle({ agents: 8, ticks: 32, seed: 42, stayHomeBps: 0 });
  const policy = runOracle({ agents: 8, ticks: 32, seed: 42, stayHomeBps: 10000 });
  expect(control.events.filter(e => e.phase === 'decision').map(e => [e.draw, e.direction]))
    .toEqual(policy.events.filter(e => e.phase === 'decision').map(e => [e.draw, e.direction]));
  expect(control.stateHash).not.toBe(policy.stateHash);
  for (const e of control.events.filter(e => e.phase === 'decision')) {
    expect(e.action).toBe('walk');
    expect(e.after[2]).toBe(e.before[2] - 1);
    const dx = (e.after[0] - e.before[0] + 16) % 16, dy = (e.after[1] - e.before[1] + 16) % 16;
    expect([[1, 0], [0, 1], [15, 0], [0, 15]]).toContainEqual([dx, dy]);
  }
  expect(policy.final.every(r => r.resource <= 100 && r.resource >= 0)).toBe(true);
  expect(policy.events.filter(e => e.phase === 'contact').length).toBe(192);
  for (const e of policy.events) {
    for (const parent of e.parents) { expect(parent).toBeLessThan(e.id); expect(policy.events[parent].tick).toBe(e.tick); }
    if (e.phase === 'contact') {
      expect(e.before[0] + e.before[1]).toBe(e.after[0] + e.after[1]);
      expect(e.actors.every(id => Math.floor(id / 4) === e.household)).toBe(true);
    }
  }
});

test('all four integer movement directions are exercised', () => {
  const run = runOracle({ agents: 100, ticks: 2, stayHomeBps: 0 });
  expect(new Set(run.events.filter(e => e.phase === 'decision').map(e => e.direction)).size).toBe(4);
});

test('rejects malformed, excessive and unknown recipes', () => {
  for (const input of [null, [], { agents: -1 }, { agents: 10001 }, { agents: 0.5 }, { ticks: 33 },
    { ticks: NaN }, { seed: -1 }, { seed: 0x100000000 }, { seed: 0.5 }, { stayHomeBps: 10001 },
    { stayHomeBps: -1 }, { agents: null }, { extra: 1 }]) expect(() => normalizeInput(input)).toThrow();
});

test('population, resources, membership, missing evidence and causal tampering fail closed', () => {
  const original = runOracle({ agents: 5, ticks: 2, stayHomeBps: 10000 });
  for (const mutate of [
    r => r.final.pop(), r => r.final[0].resource = 101, r => r.final[0].resource = -1,
    r => r.final[0].resource = 0.5, r => r.final[0].x = 16, r => r.final[0].household = 1,
    r => r.initial[0].id = 1, r => r.events.shift(), r => r.events.pop(),
    r => r.events[0].tick = 2, r => r.events[0].parents = [0],
    r => r.events[5].parents = [], r => r.events[0].after[2]++,
    r => r.seed = 7, r => r.input.seed++, r => r.rules = 'unknown', r => r.source = 'observed',
    r => r.stateHash = 'forged', r => r.eventHash = 'forged', r => r.invariants.events++,
    r => r.events.reverse(), r => r.events[0].tick = -1,
  ]) {
    const run = structuredClone(original); mutate(run);
    expect(() => validateRun(run)).toThrow();
  }
  expect(() => assertState(null, original.input)).toThrow();
  expect(() => assertState(new Array(5), original.input)).toThrow();
});

test('fresh process matches both versioned goldens', () => {
  const cli = new URL('../scripts/benchmark-scalar-oracle.js', import.meta.url).pathname;
  const child = Bun.spawnSync([process.execPath, cli]);
  expect(child.exitCode).toBe(0);
  const report = JSON.parse(child.stdout.toString());
  expect(report.results.map(({ input, stateHash, eventHash, invariants }) => ({ input, stateHash, eventHash, invariants }))).toEqual(golden.cases);
});

test('CLI normal and failure entry points', () => {
  const cli = new URL('../scripts/benchmark-scalar-oracle.js', import.meta.url).pathname;
  const good = Bun.spawnSync([process.execPath, cli, JSON.stringify({ agents: 5, ticks: 2, seed: 0 })]);
  expect(good.exitCode).toBe(0);
  const report = JSON.parse(good.stdout.toString());
  expect(report.results[0].input.seed).toBe(0);
  expect(report.results[0].simulationMs).toBeGreaterThanOrEqual(0);
  expect(report.machine.bun).toBeTruthy();
  for (const arg of ['{', '{"agents":10001}']) {
    const bad = Bun.spawnSync([process.execPath, cli, arg]);
    expect(bad.exitCode).toBe(1); expect(bad.stdout.toString()).toBe('');
    expect(bad.stderr.toString()).toContain('scalar oracle:');
  }
});
