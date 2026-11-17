import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { createSurveyEligibility, validateSurvey } from '../world/onboarding/session-survey-contract.js';
import { createSessionSurveyHandler } from '../ops/session-survey/api.js';
const valid = { version: 1, consent: true, rating: '', suggestion: 'Explain the comparison.' };
const request = (data = valid, headers = {}) => new Request('https://game.test/api/session-survey', { method: 'POST', headers: { origin: 'https://game.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) });
test('offer once after two completed explicit replays, never initial play or failures', () => {
  const gate = createSurveyEligibility();
  const completed = () => gate.observe({ status: 'completed' });
  expect(completed()).toBe(false);
  gate.replayStarted(); gate.observe({ status: 'stopped' }); expect(completed()).toBe(false);
  gate.replayStarted(); gate.observe({ status: 'error' }); expect(completed()).toBe(false);
  gate.replayStarted(); expect(completed()).toBe(false); expect(completed()).toBe(false);
  gate.replayStarted(); expect(completed()).toBe(true); expect(completed()).toBe(false);
  gate.replayStarted(); expect(completed()).toBe(false);
});
test('optional questions, exact size boundary, consent and contact guard', () => {
  expect(validateSurvey({ ...valid, suggestion: 'x'.repeat(500) }).suggestion.length).toBe(500);
  expect(validateSurvey({ ...valid, rating: 'clear-and-fun', suggestion: '' }).rating).toBe('clear-and-fun');
  for (const data of [null, [], { ...valid, consent: false }, { ...valid, suggestion: '' }, { ...valid, suggestion: 'x'.repeat(501) }, { ...valid, suggestion: 'me@example.com' }, { ...valid, suggestion: 'https://example.com' }, { ...valid, email: 'extra' }, { ...valid, rating: 'unknown' }]) expect(() => validateSurvey(data)).toThrow();
});
test('API stores only answers privately, persists restart and rejects unsafe requests', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'survey-'));
  try {
    const handler = createSessionSurveyHandler({ directory });
    expect((await handler(request())).status).toBe(201);
    expect((await createSessionSurveyHandler({ directory })(request())).status).toBe(201);
    const db = new Database(join(directory, 'suggestions.sqlite'), { readonly: true });
    expect(db.query('SELECT * FROM suggestions').all()).toEqual([{ rating: '', suggestion: valid.suggestion }, { rating: '', suggestion: valid.suggestion }]); db.close();
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, 'suggestions.sqlite')).mode & 0o777).toBe(0o600);
    expect((await handler(request({ ...valid, consent: false }))).status).toBe(400);
    expect((await handler(request(valid, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await handler(new Request('https://game.test/api/session-survey'))).status).toBe(405);
    expect((await handler(request('x'.repeat(4096)))).status).toBe(413);
    expect((await handler(request(valid, { 'content-type': 'text/plain' }))).status).toBe(415);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('invalid consent creates no storage; storage failure is generic', async () => {
  const directory = join(tmpdir(), 'survey-' + crypto.randomUUID());
  expect((await createSessionSurveyHandler({ directory })(request({ ...valid, consent: false }))).status).toBe(400);
  expect(existsSync(directory)).toBe(false);
  const response = await createSessionSurveyHandler({ directory: '/dev/null/unavailable' })(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Feedback unavailable. Try again later.' });
});
test('form blocks unconsented sends, exposes pending/failure/retry/success and dismisses without sending', async () => {
  const { mountSessionSurvey } = await import('../world/onboarding/session-survey.js');
  const consent = { checked: false, addEventListener(_, fn) { this.change = fn; } };
  const rating = { value: '' }, suggestion = { value: 'Explain the comparison.' };
  const send = {}, status = {}, skip = {};
  const form = { elements: { consent, rating, suggestion }, reset() { consent.checked = false; rating.value = ''; suggestion.value = ''; }, querySelector(selector) { return selector === '[type=submit]' ? send : selector === '[role=status]' ? status : skip; } };
  const panel = { dataset: {}, querySelector() { return form; }, remove() {} };
  const calls = []; let resolve;
  const survey = mountSessionSurvey({ ownerDocument: { createElement() { return panel; } }, append() {} }, { fetchImpl: (url, options) => { calls.push({ url, options }); return new Promise(done => { resolve = done; }); } });
  survey.replayStarted(); survey.update({ status: 'completed' });
  survey.replayStarted(); survey.update({ status: 'completed' });
  const submit = () => form.onsubmit({ preventDefault() {} });
  await submit(); expect(calls).toHaveLength(0);
  consent.checked = true; consent.change(); expect(send.disabled).toBe(false);
  const first = submit(); expect(send.disabled).toBe(true); expect(status.textContent).toContain('Sending');
  await submit(); expect(calls).toHaveLength(1);
  resolve({ ok: false }); await first; expect(status.textContent).toContain('Could not confirm'); expect(send.disabled).toBe(false);
  const second = submit(); resolve({ ok: true }); await second;
  expect(status.textContent).toContain('feedback was saved'); expect(consent.checked).toBe(false); expect(send.disabled).toBe(true);
  expect(calls[0].options.credentials).toBe('omit'); expect(calls[0].options.referrerPolicy).toBe('no-referrer');
  skip.onclick(); expect(panel.hidden).toBe(true); await submit(); expect(calls).toHaveLength(2);
  survey.dispose();
});
