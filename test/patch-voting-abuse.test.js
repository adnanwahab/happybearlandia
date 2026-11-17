import { test, expect } from 'bun:test';
import { createPatchVotingHandler } from '../ops/patch-voting/api.js';

const origin = 'https://ballot.example';
const fixture = { consent: true, title: '<img src=x onerror=alert(1)>',
  details: '<script>alert(1)</script> javascript:alert(1) https://evil.example', kind: 'problem',
  replaySeed: '<svg onload=alert(1)>' };
function post(h, body = fixture, headers = {}, path = '/suggestions') {
  return h(new Request(origin + '/api/patch-votes' + path, { method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
}
test('adversarial text is retained privately as data; failed requests collect no token or record', async () => {
  const h = createPatchVotingHandler({ dbPath: ':memory:', secret: 'test-only' });
  try {
    for (const headers of [{ origin: 'https://evil.example' }, { origin: 'null' }, { origin: '' },
      { 'content-type': 'text/plain' }]) {
      const r = await post(h, fixture, headers);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.headers.get('set-cookie')).toBeNull();
    }
    for (const body of [{ ...fixture, consent: false }, { ...fixture, title: 'bad\u0000title' },
      { ...fixture, worldContext: { scenarioId: 'javascript:alert(1)' } }, { ...fixture, url: 'https://evil.example' }]) {
      expect((await post(h, body)).status).toBe(400);
    }
    expect(h.store.listSuggestions()).toHaveLength(0);
    const accepted = await post(h);
    expect(accepted.status).toBe(202);
    expect(accepted.headers.get('set-cookie')).toContain('HttpOnly; Path=/api/patch-votes; SameSite=Strict');
    expect(accepted.headers.get('set-cookie')).toContain('; Secure');
    expect(h.store.listSuggestions()[0]).toMatchObject({ title: fixture.title, details: fixture.details, replay_seed: fixture.replaySeed });
    for (const path of ['/api/patches', '/api/patch-votes']) {
      const r = await h(new Request(origin + path));
      expect(await r.text()).not.toContain('onerror');
      expect(r.headers.get('set-cookie')).toBeNull();
    }
  } finally { h.close(); }
});
test('chunked oversized bodies are cancelled before the stream finishes', async () => {
  const h = createPatchVotingHandler({ dbPath: ':memory:', secret: 'test-only' });
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1025)); },
    cancel() { cancelled = true; } });
  try {
    const r = await h(new Request(origin + '/api/patch-votes/suggestions', {
      method: 'POST', headers: { origin, 'content-type': 'application/json', 'content-length': '1' }, body, duplex: 'half' }));
    expect(r.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(h.store.listSuggestions()).toHaveLength(0);
  } finally { h.close(); }
});
test('shared budgets bound cookie-reset floods, recover, and roll back rejected changes', async () => {
  let now = 1800000000000;
  const h = createPatchVotingHandler({ dbPath: ':memory:', secret: 'test-only', now: () => now });
  try {
    for (let i = 0; i < 30; i++) expect((await post(h)).status).toBe(202);
    const blocked = await post(h);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('set-cookie')).toBeNull();
    expect(h.store.listSuggestions()).toHaveLength(30);
    now += 3600001;
    expect((await post(h)).status).toBe(202);
    for (let i = 0; i < 120; i++) expect((await post(h, { consent: true, value: 1 }, {}, '/U06/vote')).status).toBe(200);
    expect((await post(h, { consent: true, value: -1 }, {}, '/U06/vote')).status).toBe(429);
    expect(h.store.list().find(p => p.id === 'U06')).toMatchObject({ votes: 120, score: 120 });
    now += 60001;
    expect((await post(h, { consent: true, value: -1 }, {}, '/U06/vote')).status).toBe(200);
  } finally { h.close(); }
});
