import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createCausalStore } from '../shared/causality/storage.js';
import { createCausalityHandler } from '../world/causality/api.js';
import { discoverMonthlyObservations } from '../world/discoveries/engine.js';
import { demoRunId, readMonthlyDiscoveries } from '../world/discoveries/records.js';

const run = {
  id: demoRunId,
  status: 'completed',
  metadata: { manifest: { domain: 'world-city' }, metricDefinitions: [{ id: 'rent', label: 'Rent' }] },
};
const row = (tick, value, extra = {}) => ({
  context: { runId: run.id, tick }, id: 'obs-' + tick, metricId: 'rent', entityId: 'city',
  unit: 'USD/month', value, provenance: { id: 'source-' + tick, kind: 'simulated' }, ...extra,
});

test('flags a large move, a reversal and an outlier with ordered original evidence', () => {
  const rows = [100, 100, 100, 100, 100, 100, 150, 100].map((value, tick) => row(tick, value));
  const result = discoverMonthlyObservations(run, rows);
  expect(result).toEqual(discoverMonthlyObservations(run, [...rows].reverse()));
  expect(result.findings.map(({ kind, month }) => [kind, month]))
    .toEqual([['change', 7], ['reversal', 7], ['change', 6], ['outlier', 6]]);
  expect(result.findings[1]).toMatchObject({ label: 'Rent', unit: 'USD/month', runId: run.id, evidence: rows.slice(5) });
  expect(result.findings[3]).toMatchObject({
    statistics: { median: 100, mad: 0 }, evidence: rows.slice(0, 7),
  });
});

test('uses the relative threshold symmetrically and compares outliers against historical spread', () => {
  const rows = [0, -20, 0, 100, 120, 80, 120, 80, 110, 130].map((value, tick) => row(tick, value));
  const { findings } = discoverMonthlyObservations(run, rows);
  expect(findings.some(f => f.kind === 'reversal' && f.month === 2)).toBe(true);
  expect(findings.some(f => f.kind === 'change' && f.month === 5)).toBe(true);
  expect(findings.some(f => f.kind === 'outlier' && f.month === 9)).toBe(false);
  const aboveSpread = [99, 100, 101, 99, 100, 101, 125].map((value, tick) => row(tick, value));
  expect(discoverMonthlyObservations(run, aboveSpread).findings.find(f => f.kind === 'outlier'))
    .toMatchObject({ month: 6, statistics: { median: 100, mad: 1 } });
});

test('does not compare across entities, metrics, runs, missing months, duplicate months or unit changes', () => {
  const rows = [
    row(0, 0), row(2, 100), row(2, 101), row(3, 100),
    row(4, 1000, { unit: 'USD/year' }),
    row(5, NaN, { unit: 'USD/year' }), row(6, 5, { unit: 'USD/year' }),
    row(7, 0, { entityId: 'district' }), row(7, 0, { metricId: 'debt' }),
    row(7, 0, { context: { runId: 'foreign', tick: 7 }, unit: 'USD/year' }),
  ];
  expect(discoverMonthlyObservations(run, rows)).toEqual({
    findings: [], usable: 6, comparable: 0, outlierWindows: 0,
  });
});

test('follows sequence pagination and refuses to score truncated records', async () => {
  const fetcher = async url => {
    const { pathname, searchParams } = new URL(url, 'http://local');
    expect(searchParams.get('runId')).toBe(run.id);
    if (pathname.endsWith('/run')) return Response.json({ run });
    return searchParams.get('afterSequence') === null
      ? Response.json({ items: [row(0, 0)], nextCursor: 0 })
      : Response.json({ items: [row(1, 100)], nextCursor: null });
  };
  const result = await readMonthlyDiscoveries(run.id, { fetcher });
  expect(result.status).toBe('ready');
  expect(result.findings).toHaveLength(1);
  const endless = async url => {
    const { pathname, searchParams } = new URL(url, 'http://local');
    if (pathname.endsWith('/run')) return Response.json({ run });
    return Response.json({ items: [], nextCursor: Number(searchParams.get('afterSequence')) + 1 });
  };
  expect(await readMonthlyDiscoveries(run.id, { fetcher: endless })).toEqual({ status: 'too-large' });
});

test('reads the recorded demo through the real dispatcher and SQLite store', async () => {
  const db = new Database(':memory:');
  try {
    const handle = createCausalityHandler({ store: createCausalStore(db) });
    const fetcher = url => handle(new Request('http://local' + url));
    expect(await readMonthlyDiscoveries(demoRunId, { fetcher })).toEqual({ status: 'missing' });
    const recorded = await handle(new Request('http://local/api/causality/world-scenario', { method: 'POST' }));
    expect(recorded.status).toBe(200);
    expect((await recorded.json()).context.runId).toBe(demoRunId);

    const result = await readMonthlyDiscoveries(demoRunId, { fetcher });
    expect(result.status).toBe('ready');
    expect(result.usable).toBe(315);
    expect(result.outlierWindows).toBeGreaterThan(0);
    expect(new Set(result.findings.map(f => f.kind))).toEqual(new Set(['change', 'outlier']));
    const observation = result.findings[0].evidence.at(-1);
    expect(observation.provenance.kind).toBe('simulated');
    const query = new URLSearchParams({ runId: demoRunId, targetId: observation.id });
    expect((await fetcher('/api/causality/explain?' + query)).status).toBe(200);
  } finally {
    db.close();
  }
});
