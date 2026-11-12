import { createHmac } from 'node:crypto';
import { test, expect } from 'bun:test';
import { createPatchVotingHandler } from '../ops/patch-voting/api.js';

const url = 'https://test.example/api/patch-votes';
const secret = 'local-only-signing-secret-for-tests';
const token = 'a'.repeat(48);
const cookie = 'hbl_patch_session=' + token + '.' + createHmac('sha256', secret).update('session:' + token).digest('hex');
function init() {
  let time = Date.parse('2026-11-11T12:00:00Z');
  const handle = createPatchVotingHandler({ dbPath: ':memory:', secret, now: () => time });
  return { handle, advance: ms => { time += ms; } };
}
async function get(handle) {
  const response = await handle(new Request(url, { headers: { cookie } }));
  return { cookie, body: await response.json() };
}
function post(handle, path, cookie, body, origin = 'https://test.example') {
  return handle(new Request(url + path, {
    method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ consent: true, ...body })
  }));
}
test('votes are persistent within one browser identity and can be changed or withdrawn', async () => {
  const { handle } = init();
  try {
    const first = await get(handle);
    expect(first.body.patches.length).toBeGreaterThan(3);
    expect(first.body.votingEnabled).toBe(true);
    const a = await post(handle, '/U06/vote', first.cookie, { value: 1 });
    expect(a.status).toBe(200);
    expect((await a.json()).patches.find(p => p.id === 'U06').score).toBe(1);
    const duplicate = await post(handle, '/U06/vote', first.cookie, { value: 1 });
    expect((await duplicate.json()).patches.find(p => p.id === 'U06').votes).toBe(1);
    const change = await post(handle, '/U06/vote', first.cookie, { value: -1 });
    expect((await change.json()).patches.find(p => p.id === 'U06').score).toBe(-1);
    const withdraw = await post(handle, '/U06/vote', first.cookie, { value: 0 });
    expect((await withdraw.json()).patches.find(p => p.id === 'U06').score).toBe(0);
    expect((await get(handle)).body.patches.find(p => p.id === 'U06').score).toBe(0);
  } finally { handle.close(); }
});
test('cross-site and invalid inputs cannot vote; voting closes after its window', async () => {
  const { handle, advance } = init();
  try {
    const { cookie } = await get(handle);
    expect((await post(handle, '/U06/vote', cookie, { value: 1 }, 'https://evil.test')).status).toBe(403);
    expect((await post(handle, '/U06/vote', cookie, { value: 2 })).status).toBe(400);
    expect((await post(handle, '/fake/vote', cookie, { value: 1 })).status).toBe(404);
    advance(86400001);
    expect((await post(handle, '/U06/vote', cookie, { value: 1 })).status).toBe(409);
  } finally { handle.close(); }
});
test('public suggestions remain pending and cannot modify the approved ballot', async () => {
  const { handle } = init();
  try {
    const { cookie, body } = await get(handle);
    const response = await post(handle, '/suggestions', cookie, {
      title: 'Show more city stories',
      details: 'Show more recorded resident stories after the future branches.'
    });
    expect(response.status).toBe(202);
    expect((await response.json()).status).toBe('pending');
    expect(handle.store.listSuggestions()).toHaveLength(1);
    expect((await get(handle)).body.patches.map(p => p.id)).toEqual(body.patches.map(p => p.id));
  } finally { handle.close(); }
});
test('deployment without signing secret is read-only and disallows votes', async () => {
  const handle = createPatchVotingHandler({ dbPath: ':memory:', secret: '' });
  try {
    const response = await get(handle);
    expect(response.body.votingEnabled).toBe(false);
    expect((await post(handle, '/U06/vote', '', { value: 1 })).status).toBe(503);
  } finally { handle.close(); }
});

test('consent gates collection; reports stay private; duplicate merges retain records', async () => {
  const { handle } = init();
  try {
    const read = await handle(new Request(url));
    expect(read.headers.get('set-cookie')).toBeNull();
    const denied = await post(handle, '/suggestions', '', { consent: false, title: 'Problem report title', details: 'The timeline stopped responding.' });
    expect(denied.status).toBe(400);
    expect(denied.headers.get('set-cookie')).toBeNull();
    expect(handle.store.listSuggestions()).toHaveLength(0);
    const report = await post(handle, '/suggestions', cookie, { title: 'Problem report title', details: 'The timeline stopped responding.', kind: 'problem', replaySeed: '0' });
    expect(report.status).toBe(202);
    const rows = handle.store.listSuggestions();
    expect(rows[0].replay_seed).toBe('0');
    expect(rows[0].status).toBe('pending');
    expect(JSON.stringify((await get(handle)).body)).not.toContain('timeline stopped');
    const a = handle.store.suggest('other', 'Improve timeline labels', 'Add clearer labels to the timeline.');
    const b = handle.store.suggest('other', 'Clearer timeline labels', 'Make the timeline labels easier to read.');
    handle.store.mergeIdeas(a.id, b.id);
    expect(handle.store.listSuggestions().find(row => row.id === a.id).merged_into).toBe(b.id);
    expect(() => handle.store.mergeIdeas(b.id, a.id)).toThrow();
    expect(() => handle.store.mergeIdeas(rows[0].id, b.id)).toThrow();
    expect(handle.store.triageVotes()[0].advisory).toBe(true);
  } finally { handle.close(); }
});

test('legacy suggestions migrate without loss and merged reports survive reopening', async () => {
  const { Database } = await import('bun:sqlite');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'feedback-'));
  const dbPath = join(root, 'votes.sqlite');
  let handle;
  try {
    const db = new Database(dbPath);
    db.exec("CREATE TABLE suggestion (id TEXT PRIMARY KEY, voter_key TEXT NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending')");
    db.query('INSERT INTO suggestion VALUES (?,?,?,?,?,?)').run('old','key','Existing idea','Keep this original suggestion.',1,'pending'); db.close();
    handle = createPatchVotingHandler({ dbPath, secret });
    const idea = handle.store.suggest('key', 'Another timeline idea', 'Describe the duplicate timeline idea.');
    handle.store.mergeIdeas('old', idea.id);
    handle.store.suggest('key', 'Problem without seed', 'The timeline stopped responding.', 'problem');
    handle.close(); handle = createPatchVotingHandler({ dbPath, secret });
    const rows = handle.store.listSuggestions();
    expect(rows.find(row => row.id === 'old')).toMatchObject({ kind: 'idea', status: 'merged', merged_into: idea.id, details: 'Keep this original suggestion.' });
    expect(rows.find(row => row.kind === 'problem').replay_seed).toBeNull();
  } finally { handle?.close(); rmSync(root, { recursive: true, force: true }); }
});
