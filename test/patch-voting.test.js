import { test, expect } from 'bun:test';
import { createPatchVotingHandler } from '../ops/patch-voting/api.js';

const url = 'https://test.example/api/patch-votes';
const secret = 'local-only-signing-secret-for-tests';
function init() {
  let time = Date.parse('2026-11-11T12:00:00Z');
  const handle = createPatchVotingHandler({ dbPath: ':memory:', secret, now: () => time });
  return { handle, advance: ms => { time += ms; } };
}
async function get(handle) {
  const response = await handle(new Request(url));
  return { cookie: response.headers.get('set-cookie')?.split(';')[0], body: await response.json() };
}
function post(handle, path, cookie, body, origin = 'https://test.example') {
  return handle(new Request(url + path, {
    method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body)
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
