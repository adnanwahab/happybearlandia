import { test, expect } from 'bun:test';
import { clusterFailures } from '../world/decision/backlog-explanations/clusters.js';
import { answerEvidence, recordedRipple } from '../world/decision/backlog-explanations/evidence.js';
import { housingModel, simulateHousingRun, createHousingScenarios } from '../world/models/housing/index.js';
import { housingCausalRegistry as registry } from '../world/models/housing/causal-registry.js';
const experiment = { scenarios: [{ id: 'plan', successCriterion: { metricId: 'affordability', operator: 'gte', value: 50 } }] };
const rows = [0, 1, 2, 90, 91, 92].map((v, i) => ({ id: `r${i}`, scenarioId: 'plan', seed: i, modelVersion: housingModel.version, status: 'completed', metrics: { affordability: 40 }, sampledParameters: { construction_capacity: v * 1000, interest_rate: v / 1000 } }));
const args = { experiment, runs: rows, model: housingModel, features: ['construction_capacity', 'interest_rate'], k: 2 };
test('independent clustering partitions two clouds, with normalized scale and deterministic replay', () => {
  const before = JSON.stringify(args);
  const a = clusterFailures(args), b = clusterFailures({ ...args, runs: [...rows].reverse() });
  expect(a).toEqual(b); expect(JSON.stringify(args)).toBe(before);
  expect(a.groups[0].clusters.map(c => c.runIds)).toEqual([['r0', 'r1', 'r2'], ['r3', 'r4', 'r5']]);
  expect(a.groups[0].normalization[0].max).toBe(92000);
});
test('missing, unclassified, numerical failures, constant inputs, version isolation, duplicate IDs', () => {
  const extra = [{ ...rows[0], id: 'missing', sampledParameters: {} }, { ...rows[0], id: 'crash', status: 'failed' }, { ...rows[0], id: 'unclassified', metrics: {} }, { ...rows[0], id: 'legacy', modelVersion: '1.0.0' }];
  const result = clusterFailures({ ...args, runs: [...rows, ...extra] });
  expect(result.failureCount).toBe(8); expect(result.groups).toHaveLength(2);
  expect(result.groups.find(g => g.modelVersion === housingModel.version).excludedRunIds).toEqual(['missing']);
  expect(clusterFailures({ ...args, runs: [{ ...rows[0] }, { ...rows[0], id: 'constant' }] }).groups[0].clusters).toHaveLength(1);
  expect(() => clusterFailures({ ...args, runs: [rows[0], rows[0]] })).toThrow('Duplicate');
  expect(() => clusterFailures({ ...args, features: ['unknown'] })).toThrow();
  expect(clusterFailures({ ...args, runs: [] }).groups).toEqual([]);
});
const scenarios = createHousingScenarios().slice(0, 2);
const actual = scenarios.map((s, i) => ({ ...simulateHousingRun({ parameters: s.parameters, seed: 0, years: 2 }), id: `actual-${i}`, experimentId: 'actual', engineVersion: 'test-engine', seed: 0, status: 'completed', scenarioId: s.id, modelVersion: housingModel.version }));
test('recorded ripple preserves real event index, dates, rules and no future leakage', () => {
  const result = recordedRipple({ run: actual[1], registry, month: 12 });
  expect(result.available).toBe(true); expect(result.frames.length).toBeGreaterThan(0);
  for (const frame of result.frames) { expect(frame.month).toBeLessThanOrEqual(12); expect(frame.event).toEqual(actual[1].events[frame.reference.eventIndex]); for (const edge of frame.edges) expect(registry.edges.some(e => e.id === edge.id)).toBe(true); }
  expect(recordedRipple({ run: { ...actual[1], modelVersion: 'unknown' }, registry }).available).toBe(false);
  const missing = recordedRipple({ run: { ...actual[1], events: [{ type: 'unmapped' }, { month: 1, type: 'unmapped' }] }, registry });
  expect(missing.omittedUndatedEvents).toBe(1); expect(missing.frames[0].edges).toEqual([]);
});
test('named natural-language queries use actual same-seed metrics and exact checkpoints', () => {
  const args = { run: actual[1], referenceRun: actual[0], registry, model: housingModel };
  const compare = answerEvidence({ ...args, query: 'What changed in median rent between these futures?' });
  expect(compare.kind).toBe('compare'); expect(compare.delta).toBe(actual[1].metrics.median_rent - actual[0].metrics.median_rent);
  const why = answerEvidence({ ...args, query: 'Explain why median rent increased', month: 12 });
  expect(why.kind).toBe('why'); expect(why.equations.map(e => e.id)).toContain('rent-vacancy'); expect(why.drivers).toEqual([]);
  expect(why.events.every(e => e.month <= 12)).toBe(true);
  expect(answerEvidence({ ...args, query: 'Why?', month: 12 }).kind).toBe('clarify');
  expect(answerEvidence({ ...args, query: 'Why median rent and housing supply?' }).kind).toBe('ambiguous');
  expect(answerEvidence({ ...args, query: 'Compare median rent', month: 1.5 }).kind).toBe('unavailable');
  expect(answerEvidence({ ...args, query: 'Compare median rent', referenceRun: { ...actual[0], seed: 42 } }).kind).toBe('unavailable');
  expect(answerEvidence({ ...args, query: 'Compare median rent', referenceRun: { ...actual[0], monthlyTimeline: actual[0].monthlyTimeline.slice(0, -1) } }).kind).toBe('unavailable');
});

test('multi-group order invariance, complete exclusion and bounded nonconvergence audit', () => {
  const variants = rows.flatMap(r => [r, { ...r, id: 'other-' + r.id, scenarioId: 'other' }, { ...r, id: 'legacy-' + r.id, modelVersion: '1.0.0' }]);
  const input = { ...args, experiment: { scenarios: [...experiment.scenarios, { ...experiment.scenarios[0], id: 'other' }] }, runs: variants };
  expect(clusterFailures(input)).toEqual(clusterFailures({ ...input, runs: [...variants].reverse() }));
  expect(clusterFailures({ ...args, runs: rows.map(r => ({ ...r, sampledParameters: {} })) }).groups[0].clusters).toEqual([]);
  const shifting = [0, 1, 2, 3, 4, 10, 11, 12, 20].map((v,i) => ({ ...rows[0], id: String(i).padStart(2,'0'), sampledParameters: { construction_capacity: v } }));
  const limited = clusterFailures({ ...args, runs: shifting, features: ['construction_capacity'], maxIterations: 1 }).groups[0];
  expect(limited.iterations).toBe(1); expect(limited.converged).toBe(false);
  expect(clusterFailures({ ...args, runs: shifting, features: ['construction_capacity'] }).groups[0].converged).toBe(true);
  expect(() => clusterFailures({ ...args, maxIterations: 51 })).toThrow();
});
test('selected month never consumes final drivers, future events or duplicate snapshots', () => {
  const run = { ...actual[1], drivers: [{ metricId: 'median_rent', value: 999999 }], events: [...actual[1].events, { month: 24, type: 'annual-accounting', label: 'future secret' }] };
  const args = { query: 'Why median rent?', run, registry, model: housingModel, month: 12 };
  const result = answerEvidence(args);
  expect(result.drivers).toEqual([]); expect(JSON.stringify(result)).not.toContain('future secret'); expect(JSON.stringify(result)).not.toContain('999999');
  expect(answerEvidence({ ...args, month: -1 }).kind).toBe('unavailable');
  expect(answerEvidence({ ...args, run: { ...run, monthlyTimeline: [...run.monthlyTimeline, run.monthlyTimeline[12]] } }).kind).toBe('unavailable');
});
test('comparison blocks unknown or unequal authority and malformed clocks', () => {
  const args = { query: 'Compare median rent', run: actual[1], referenceRun: actual[0], registry, model: housingModel };
  for (const patch of [{ experimentId: undefined }, { experimentId: 'other' }, { engineVersion: undefined }, { engineVersion: 'other' }, { modelVersion: 'other' }, { seed: 1 }, { monthlyTimeline: [{ month: -1, metrics: actual[0].metrics }] }, { monthlyTimeline: [...actual[0].monthlyTimeline, actual[0].monthlyTimeline[0]] }]) expect(answerEvidence({ ...args, referenceRun: { ...actual[0], ...patch } }).kind).toBe('unavailable');
});
