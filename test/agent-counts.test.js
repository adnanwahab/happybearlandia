import { test, expect } from 'bun:test';
import { runFixture, validateRun, exportAgentCounts, interactionClaim, LIMITS } from '../world/metrics/agent-counts.js';
const report = (run, options = {}) => exportAgentCounts(run, { wallSeconds: 2, ...options });
test('six independent counts and measured rate semantics', () => {
  const run = runFixture({ residents: 2, ticks: 3 });
  expect(report(run).counts).toEqual({ residentRecords: 2, independentlyUpdatedStates: 2,
    eventDrivenUpdates: 6, modeledPairwiseInteractions: 3, visibleAvatars: 0, aggregateCohortWeight: 0 });
  expect(report(run).rates).toEqual({ interactionsPerSecond: 1.5, simulationTicksPerSecond: 1.5, renderFPS: null });
  expect(report(run).activeCount).toBe(2);
  expect(report(run, { wallSeconds: 0 }).rates.interactionsPerSecond).toBeNull();
});
test('CPU oracle conserves energy and follows every recorded dependency', () => {
  const run = runFixture();
  const energy = new Map(run.initial.map(row => [row.id, row.energy]));
  for (const event of run.events) {
    expect(event.before).toEqual([energy.get(event.from), energy.get(event.to)]);
    energy.set(event.from, energy.get(event.from) - 1);
    energy.set(event.to, energy.get(event.to) + 1);
    expect(event.after).toEqual([energy.get(event.from), energy.get(event.to)]);
  }
  expect(run.final.map(row => row.energy)).toEqual([...energy.values()]);
  expect([...energy.values()].reduce((a, b) => a + b, 0)).toBe(1280);
  expect(validateRun(run)).toEqual(run.final);
});
test('positive durations cannot silently serialize overflow as unavailable throughput', () => {
  expect(() => report(runFixture({ residents: 2, ticks: 1 }), { wallSeconds: Number.MIN_VALUE }))
    .toThrow('nonfinite throughput');
  // A run without interactions still has a tick rate that must remain finite.
  expect(() => report(runFixture({ residents: 0, ticks: 1 }), { wallSeconds: Number.MIN_VALUE }))
    .toThrow('nonfinite throughput');
  const empty = report(runFixture({ residents: 0, ticks: 0 }), { wallSeconds: Number.MIN_VALUE });
  expect(JSON.parse(JSON.stringify(empty)).rates).toEqual({ interactionsPerSecond: 0,
    simulationTicksPerSecond: 0, renderFPS: null });
  const finite = report(runFixture({ residents: 2, ticks: 1 }), { wallSeconds: 2 / Number.MAX_VALUE });
  expect(Number.isFinite(finite.rates.interactionsPerSecond)).toBe(true);
  expect(JSON.parse(JSON.stringify(finite)).rates.interactionsPerSecond).toBe(finite.rates.interactionsPerSecond);
});
test('rejects no-op, forged, missing and reordered transition evidence', () => {
  for (const mutate of [r => { r.events[0].after = r.events[0].before; },
    r => { r.events[0].source = 'unsourced'; }, r => { delete r.initial; },
    r => { delete r.events; }, r => { r.events.pop(); }, r => { r.final[0].energy++; },
    r => { r.events.reverse(); }, r => { r.events[0].from = r.events[0].to; },
    r => { r.rules = 'unknown'; }, r => { delete r.seed; }]) {
    const run = runFixture(); mutate(run); expect(() => report(run)).toThrow();
  }
});
test('deterministic seed/version metadata and seed-matched replay', () => {
  expect(runFixture()).toEqual(runFixture());
  expect(runFixture({ seed: 0 })).not.toEqual(runFixture({ seed: 42 }));
  const run = runFixture(); run.seed++; expect(() => validateRun(run)).toThrow();
  expect(report(runFixture()).model).toBe('synthetic-energy-transfer.v1');
  expect(report(runFixture()).seed).toBe(42);
});
test('empty, singleton, zero ticks and maximum bounded inputs', () => {
  for (const residents of [0, 1, LIMITS.residents]) {
    const run = runFixture({ residents, ticks: residents < 2 ? 1000 : 0 });
    expect(report(run).counts.modeledPairwiseInteractions).toBe(0);
    expect(report(run).activeCount).toBe(0);
  }
  expect(validateRun(runFixture({ residents: LIMITS.residents, ticks: LIMITS.ticks, seed: 0xffffffff })).length).toBe(LIMITS.residents);
});
test('invalid counts, settings, durations and headless render claims', () => {
  for (const value of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    for (const key of ['residents', 'ticks', 'seed']) expect(() => runFixture({ [key]: value })).toThrow();
    expect(() => report(runFixture(), { visibleAvatars: value })).toThrow();
  }
  for (const options of [{ wallSeconds: -1 }, { wallSeconds: NaN }, { wallSeconds: Infinity },
    { aggregateCohortWeight: -1 }, { aggregateCohortWeight: Infinity }, { visibleAvatars: 1 }, { renderedFrames: 1 }])
    expect(() => report(runFixture(), options)).toThrow();
  expect(() => runFixture({ residents: LIMITS.residents + 1 })).toThrow();
  expect(() => runFixture({ ticks: LIMITS.ticks + 1 })).toThrow();
});
test('weights and resident records never become interaction claims', () => {
  const run = runFixture({ residents: 4096, ticks: 0 });
  expect(report(run, { aggregateCohortWeight: 1_000_000 }).counts.modeledPairwiseInteractions).toBe(0);
  expect(interactionClaim(run)).toBe('0 verified synthetic pairwise interactions');
  expect(() => interactionClaim({ counts: { visibleAvatars: 1_000_000 } })).toThrow();
});
