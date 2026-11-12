import { expect, test } from 'bun:test';
import { stat } from 'node:fs/promises';

const sourceStoreMetadata = async (path = '.data/city-history.sqlite') => stat(path)
  .then(info => ({ size: info.size, mtimeMs: info.mtimeMs }))
  .catch(error => { if (error.code === 'ENOENT') return null; throw error; });
import { assessHeaders, collectHeaders, loopbackOrigin, runLocalAudit, probes } from '../ops/static-asset-cache-audit.mjs';

test('audit refuses remote origins, credentials, and paths before requesting anything', () => {
  for (const origin of ['https://happybearlandia.fly.dev', 'http://user:pass@localhost', 'http://localhost/path',
    'http://localhost/?secret=value', 'ftp://localhost', 'http://127.0.0.1.evil.test']) {
    expect(() => loopbackOrigin(origin)).toThrow();
  }
  expect(loopbackOrigin('http://127.0.0.1:3100')).toBe('http://127.0.0.1:3100');
});

test('missing freshness, dynamic caching, immutable assertions and errors are distinguished', () => {
  expect(assessHeaders({ kind: 'image', status: 404, expectedStatus: 200, headers: {} }).issues).toContain('unexpected-status');
  expect(assessHeaders({ kind: 'html', status: 200, headers: {} }).issues).toContain('html-freshness-unspecified');
  expect(assessHeaders({ kind: 'dynamic', status: 200, headers: { 'cache-control': 'public, max-age=300' } }).issues).toContain('dynamic-no-store-missing');
  expect(assessHeaders({ kind: 'javascript', status: 200, headers: { 'cache-control': 'public, max-age=31536000, immutable' } }).issues).toContain('immutable-needs-content-hash-and-publication-proof');
  expect(assessHeaders({ kind: 'missing', status: 404, headers: {} }).issues).toContain('error-cache-policy-unspecified');
  expect(assessHeaders({ kind: 'dynamic', status: 200, headers: { 'cache-control': 'private, no-store' } }).issues).toEqual([]);
});

test('header evidence is bounded to selected fields, omits cookies/body content and records failures', async () => {
  let count = 0;
  const rows = await collectHeaders('http://localhost:3100', { fetcher: async (_url, options) => {
    count++;
    expect(['GET', 'HEAD']).toContain(options.method);
    expect(options.redirect).toBe('error');
    if (count === 1) throw new Error('secret error text');
    return new Response(options.method === 'HEAD' ? null : 'private body', {
      headers: { 'cache-control': 'no-store', 'set-cookie': 'private-cookie', 'x-private-secret': 'never-record' },
    });
  } });
  expect(rows).toHaveLength(probes.length * 2);
  expect(rows[0].error).toBe('request-failed');
  const evidence = JSON.stringify(rows);
  expect(evidence).not.toContain('private body');
  expect(evidence).not.toContain('private-cookie');
  expect(evidence).not.toContain('never-record');
  expect(evidence).not.toContain('secret error text');
});

test('oversized responses fail visibly instead of retaining an unbounded body', async () => {
  const rows = await collectHeaders('http://localhost:3100', { fetcher: async () =>
    new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); } })) });
  expect(rows.every(row => row.error === 'body-limit-exceeded')).toBe(true);
  expect(rows.every(row => row.bodySha256 === undefined)).toBe(true);
});

test('actual isolated server preserves World freshness, dynamic no-store, source denial and GET/HEAD semantics', async () => {
  const before = await sourceStoreMetadata();
  const voteStoreBefore = await sourceStoreMetadata('.hbl-private/patch-votes.sqlite');
  const evidence = await runLocalAudit();
  expect(await sourceStoreMetadata()).toEqual(before);
  expect(await sourceStoreMetadata('.hbl-private/patch-votes.sqlite')).toEqual(voteStoreBefore);
  expect(evidence.evidenceType).toBe('local-non-production');
  expect(evidence.stagingVerified).toBe(false);
  expect(evidence.responses.filter(row => row.error)).toEqual([]);
  for (const row of evidence.responses) {
    expect(row.status).toBe(row.expectedStatus);
    if (row.kind === 'dynamic') {
      const status = row.method === 'HEAD' ? row.path === '/api/world-experiments' ? 405 : row.path === '/api/patch-votes' ? 404 : 200 : 200;
      expect(row.status).toBe(status);
      expect(row.assessment.issues).toEqual([]);
    }
    if (['private-source-denial', 'malformed-path-denial', 'missing'].includes(row.kind)) expect(row.status).toBe(404);
    if (row.path.startsWith('/world/') && row.status === 200) expect(row.headers['cache-control']).toBe('no-cache');
    if (row.method === 'HEAD') expect(row.bodyBytes).toBe(0);
  }
  expect(evidence.responses.find(row => row.path === '/' && row.method === 'GET').assessment.issues).toContain('html-freshness-unspecified');
  const ballot = evidence.responses.filter(row => row.path === '/vote-on-patch');
  expect(ballot.map(row => [row.method, row.status])).toEqual([['GET', 200], ['HEAD', 200]]);
  expect(ballot[0].headers['cache-control']).toBe('no-cache');
  const votes = evidence.responses.filter(row => row.path === '/api/patch-votes');
  expect(votes.map(row => [row.method, row.status])).toEqual([['GET', 200], ['HEAD', 404]]);
  for (const row of votes) {
    expect(row.headers['cache-control']).toBe('no-store');
    expect(row.headers['set-cookie']).toBeUndefined();
    expect(row.headers.authorization).toBeUndefined();
  }
  expect(evidence.inventory.models.count).toBeGreaterThan(0);
  expect(evidence.inventory.javascript.count).toBeGreaterThan(0);
}, 45000);
