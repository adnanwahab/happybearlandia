import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { createPlayerFeedbackHandler } from '../ops/player-feedback/api.js';
const valid = { version: 1, consent: true, kind: 'confusing', moment: 'choosing' };
const request = (body = valid, options = {}) => new Request('https://game.test/api/player-feedback', {
  method: 'POST', headers: { origin: 'https://game.test', 'content-type': 'application/json', ...options.headers }, body: JSON.stringify(body), ...options,
});
test('consented choices persist as aggregates across handler restart, with private permissions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hbl-feedback-'));
  try {
    const handle = createPlayerFeedbackHandler({ directory });
    expect((await handle(request())).status).toBe(201);
    expect((await handle(request())).status).toBe(201);
    expect((await createPlayerFeedbackHandler({ directory })(request({ ...valid, kind: 'favorite' }))).status).toBe(201);
    const db = new Database(join(directory, 'counts.sqlite'), { readonly: true });
    expect(db.query('SELECT * FROM feedback_counts ORDER BY kind').all()).toEqual([
      { kind: 'confusing', moment: 'choosing', count: 2 }, { kind: 'favorite', moment: 'choosing', count: 1 },
    ]);
    db.close();
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, 'counts.sqlite')).mode & 0o777).toBe(0o600);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('opt-out, arbitrary text, identifiers and malformed choices never initialize storage', async () => {
  const directory = join(tmpdir(), 'hbl-feedback-absent-' + crypto.randomUUID());
  const handle = createPlayerFeedbackHandler({ directory });
  for (const body of [null, [], { ...valid, consent: false }, { ...valid, email: 'private@example.test' }, { ...valid, moment: 'identifier' }, { ...valid, kind: 'text' }]) expect((await handle(request(body))).status).toBe(400);
  expect((await handle(request('x'.repeat(600)))).status).toBe(413);
  expect((await handle(request(valid, { headers: { origin: 'https://elsewhere.test' } }))).status).toBe(403);
  expect((await handle(new Request('https://game.test/api/player-feedback'))).status).toBe(405);
  expect(() => statSync(directory)).toThrow();
});
test('storage failure returns a generic nonblocking error without exposing paths', async () => {
  const response = await createPlayerFeedbackHandler({ directory: '/dev/null/unavailable' })(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Feedback temporarily unavailable' });
});

test('form requires consent, sends only choices, recovers from network failure and supports opt-out', async () => {
  const { mountPlayerFeedback } = await import('../world/player-feedback.js');
  const previous = globalThis.document;
  const consent = { checked: false }, send = { disabled: true }, status = {}, dismiss = {};
  const form = { elements: { consent, kind: { value: 'favorite' }, moment: { value: 'comparing' } }, querySelector: selector => selector === '[type=submit]' ? send : selector === '[role=status]' ? status : dismiss };
  const panel = { open: true, querySelector: () => form };
  globalThis.document = { createElement: () => panel };
  const calls = []; let fail = true;
  try {
    mountPlayerFeedback({ append() {} }, { fetchImpl: async (url, options) => { calls.push({ url, options }); if (fail) throw Error('network'); return { ok: true }; } });
    const submit = () => form.onsubmit({ preventDefault() {} });
    await submit(); expect(calls).toHaveLength(0);
    consent.checked = true; consent.onchange(); expect(send.disabled).toBe(false);
    await submit(); expect(status.textContent).toContain('could not be confirmed'); expect(send.disabled).toBe(false);
    expect(JSON.parse(calls[0].options.body)).toEqual({ version: 1, consent: true, kind: 'favorite', moment: 'comparing' });
    expect(calls[0].options.credentials).toBe('omit'); expect(calls[0].options.referrerPolicy).toBe('no-referrer');
    fail = false; await submit(); expect(status.textContent).toContain('counted privately'); expect(consent.checked).toBe(false); expect(send.disabled).toBe(true);
    consent.checked = true; dismiss.onclick(); expect(panel.open).toBe(false); expect(consent.checked).toBe(false);
    await submit(); expect(calls).toHaveLength(2);
  } finally { globalThis.document = previous; }
});
