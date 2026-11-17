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

function fixture() {
  const consent = { checked: false }, wow = { disabled: true }, confusing = { disabled: true };
  const status = {}, dismiss = {}, clear = {}, summary = { focus() {} }, listeners = {};
  const form = { elements: { consent, moment: { value: 'exploring' } },
    querySelectorAll: () => [wow, confusing],
    querySelector: selector => ({ '[role=status]': status, '[data-dismiss]': dismiss, '[data-clear]': clear })[selector] };
  const panel = { open: true, querySelector: selector => selector === 'summary' ? summary : form,
    addEventListener: (type, fn) => { listeners[type] = fn; } };
  return { consent, wow, confusing, status, dismiss, clear, form, panel, listeners };
}
async function mounted(fetchImpl) {
  const { mountPlayerFeedback } = await import('../world/player-feedback.js');
  const previous = globalThis.document, f = fixture();
  globalThis.document = { createElement: () => f.panel };
  try { mountPlayerFeedback({ append() {} }, { fetchImpl }); }
  finally { globalThis.document = previous; }
  f.submit = (value = 'favorite') => f.form.onsubmit({ preventDefault() {}, submitter: { value } });
  f.allow = () => { f.consent.checked = true; f.consent.onchange(); };
  return f;
}
test('one-tap reactions require explicit consent and use the compatible minimal aggregate contract', async () => {
  const calls = []; let fail = true;
  const f = await mounted(async (url, options) => { calls.push({ url, options }); if (fail) throw Error('network'); return { ok: true }; });
  await f.submit(); expect(calls).toHaveLength(0);
  f.allow(); expect(f.wow.disabled).toBe(false);
  f.form.elements.moment.value = 'comparing';
  await f.submit(); expect(f.status.textContent).toContain('could not be confirmed'); expect(f.wow.disabled).toBe(false);
  expect(JSON.parse(calls[0].options.body)).toEqual({ version: 1, consent: true, kind: 'favorite', moment: 'comparing' });
  expect(calls[0].options.credentials).toBe('omit'); expect(calls[0].options.referrerPolicy).toBe('no-referrer');
  fail = false; await f.submit('confusing');
  expect(JSON.parse(calls[1].options.body).kind).toBe('confusing');
  expect(f.status.textContent).toContain('counted privately'); expect(f.consent.checked).toBe(false);
  expect(f.wow.disabled).toBe(true); expect(f.confusing.disabled).toBe(true);
  f.allow(); f.dismiss.onclick(); expect(f.panel.open).toBe(false); expect(f.consent.checked).toBe(false);
  await f.submit(); expect(calls).toHaveLength(2);
});
test('clear aborts pending requests, resets consent and ignores late results from a previous submission', async () => {
  const pending = [];
  const f = await mounted((url, options) => new Promise(resolve => pending.push({ resolve, options })));
  f.allow(); const first = f.submit(); await f.submit(); expect(pending).toHaveLength(1);
  f.clear.onclick(); expect(pending[0].options.signal.aborted).toBe(true);
  expect(f.status.textContent).toContain('Local choices cleared'); expect(f.consent.checked).toBe(false);
  f.allow(); const second = f.submit('confusing');
  pending[0].resolve({ ok: true }); await first;
  expect(f.wow.disabled).toBe(true); expect(f.status.textContent).toContain('Sending');
  pending[1].resolve({ ok: true }); await second;
  expect(f.status.textContent).toContain('counted privately');
});
test('unavailable response and missing reaction stay nonblocking; closing clears local input', async () => {
  let calls = 0;
  const f = await mounted(async () => { calls++; return { ok: false }; });
  f.allow(); await f.submit('unknown'); expect(calls).toBe(0);
  await f.form.onsubmit({ preventDefault() {} }); expect(calls).toBe(0);
  await f.submit(); expect(f.status.textContent).toContain('could not be confirmed');
  f.form.elements.moment.value = 'inspecting'; f.panel.open = false; f.listeners.toggle();
  expect(f.form.elements.moment.value).toBe('exploring'); expect(f.consent.checked).toBe(false);
});

test('in-place reaction integrates with the real consent validator and private aggregate store', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hbl-reaction-integration-'));
  try {
    const handle = createPlayerFeedbackHandler({ directory });
    const f = await mounted((url, options) => handle(new Request('https://game.test' + url, {
      ...options, headers: { ...options.headers, origin: 'https://game.test' },
    })));
    await f.submit(); expect(() => statSync(join(directory, 'counts.sqlite'))).toThrow();
    f.allow(); await f.submit('favorite');
    expect(f.status.textContent).toContain('counted privately');
    f.clear.onclick();
    const db = new Database(join(directory, 'counts.sqlite'), { readonly: true });
    expect(db.query('SELECT * FROM feedback_counts').all()).toEqual([{ kind: 'favorite', moment: 'exploring', count: 1 }]);
    expect(db.query('PRAGMA table_info(feedback_counts)').all().map(column => column.name)).toEqual(['kind', 'moment', 'count']);
    db.close();
    expect(f.consent.checked).toBe(false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
