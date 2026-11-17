import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectObservatory, createOperationsObservatoryHandler, source, ISSUE } from '../ops/operations-observatory.js';
const now = Date.parse('2026-11-12T12:00:00Z');
const base = { source: ISSUE, observedAt: new Date(now).toISOString() };
const feature = { id: 'feature-1', verified: true, costUSD: 12, source: ISSUE };

test('missing observations remain unavailable, distinct from measured zero', () => {
  const report = projectObservatory(null, null, now);
  expect(report.queue.total).toBeNull();
  expect(report.symphony.running).toBeNull();
  expect(report.costs.perFeatureUSD).toBeNull();
  expect(report.product.outcomes).toEqual([]);
  for (const key of ['queue', 'symphony', 'costs', 'ci', 'release', 'product']) expect(report[key].source).toBe(ISSUE);
});
test('projects coordinator holds without publishing private report fields', () => {
  const report = projectObservatory({}, { scannedAt: now / 1000, leases: { secret: 'credential' }, issues: [
    { identifier: 'SHE-202', eligible: false, reasons: ['blocked by SHE-180'], description: 'private' },
    { identifier: 'SHE-180', eligible: true, reasons: [] }, null,
  ] }, now);
  expect(report.queue.total).toBe(2);
  expect(report.queue.held).toBe(1);
  expect(report.queue.eligible).toBe(1);
  expect(report.queue.tasks[0].source).toEndWith('/SHE-202');
  expect(JSON.stringify(report)).not.toContain('credential');
  expect(JSON.stringify(report)).not.toContain('private');
});
test('timestamps distinguish stale, future and missing evidence', () => {
  for (const [observedAt, expected] of [[new Date(now - 901000).toISOString(), 'stale'], [new Date(now + 61000).toISOString(), 'unavailable'], ['bad', 'unavailable']]) {
    expect(projectObservatory({ version: 1, symphony: { ...base, observedAt, running: 0 } }, null, now).symphony.freshness).toBe(expected);
  }
  expect(projectObservatory({ version: 1, symphony: { ...base, running: 0 } }, null, now).symphony.running).toBe(0);
});
test('cost denominator uses unique verified receipts and rejects incomplete costs', () => {
  const costs = features => projectObservatory({ version: 1, costs: { ...base, features } }, null, now).costs;
  expect(costs([feature, { ...feature, id: 'feature-2', costUSD: 8 }]).perFeatureUSD).toBe(10);
  expect(costs([]).perFeatureUSD).toBeNull();
  for (const features of [[feature, feature], [{ ...feature, verified: false }], [{ ...feature, costUSD: null }], [{ ...feature, costUSD: -1 }], [null]]) expect(costs(features).perFeatureUSD).toBeNull();
  expect(costs([{ ...feature, costUSD: 0 }]).perFeatureUSD).toBe(0);
});
test('only explicit product evidence becomes an outcome; ticket volume has no conversion', () => {
  const report = projectObservatory({ version: 1, product: { ...base, closedTickets: 1000, outcomes: [{ name: 'Return rate', value: 30, unit: '%', kind: 'observed', source: ISSUE }, { name: 'Fun', value: 100, unit: '%', source: ISSUE }] } }, null, now);
  expect(report.product.outcomes).toHaveLength(1);
  expect(JSON.stringify(report.product)).not.toContain('closedTickets');
});
test('rejects unsafe links, unsupported versions and malformed lists', () => {
  for (const value of ['javascript:alert(1)', 'https://github.com/owner/repo/actions/runs/1?token=secret', 'https://user:pass@linear.app/team/issue/SHE-1', 'https://evil.test/run']) expect(source(value)).toBeNull();
  expect(projectObservatory({ version: 2, symphony: { ...base, running: 3 } }, null, now).symphony.running).toBeNull();
  expect(() => projectObservatory({ version: 1, ci: { ...base, runs: [null] }, release: { ...base, gates: [null] } }, { scannedAt: 1e200, issues: [] }, now)).not.toThrow();
});
test('handler reads bounded private inputs, redacts fields, recovers after malformed files and refuses writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hbl-observatory-'));
  const path = join(directory, 'evidence.json');
  const handler = createOperationsObservatoryHandler({ env: { HBL_OPERATIONS_EVIDENCE_PATH: path }, now: () => now });
  const get = () => handler(new Request('http://localhost/api/operations-observatory'));
  try {
    await writeFile(path, JSON.stringify({ version: 1, symphony: { ...base, running: 0, apiKey: 'private' } }));
    let response = await get();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('apiKey');
    await writeFile(path, '{');
    expect((await (await get()).json()).symphony.available).toBe(false);
    await writeFile(path, ' '.repeat(1024 * 1024 + 1));
    expect((await (await get()).json()).symphony.available).toBe(false);
    expect((await handler(new Request('http://localhost/api/operations-observatory', { method: 'POST' }))).status).toBe(405);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('malformed release gates invalidate the entire set rather than hiding a failing gate', () => {
  const passed = { name: 'Journey', status: 'passed', source: ISSUE };
  const project = gates => projectObservatory({ version: 1, release: { ...base, buildId: 'abcdef123', gates } }, null, now).release;
  expect(project([passed]).gates).toHaveLength(1);
  expect(project([passed, { name: 'Backup', status: 'invalid', source: ISSUE }]).gates).toEqual([]);
  expect(project([passed, null]).gates).toEqual([]);
});
