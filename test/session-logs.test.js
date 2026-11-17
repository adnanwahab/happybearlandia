import { test, expect } from 'bun:test';
import { SESSION_LOG_KEY, SESSION_TTL_MS, MAX_EVENTS, createSessionRecorder, hasSessionConsent, setSessionConsent, readSessions, sanitizeSessionEvent, sessionFrameAt } from '../world/session-log.js';
const id = 'fps_' + 'a'.repeat(32);
function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; }
test('optional capture is off by default; revoke deletes and stops future writes', () => {
  const s = storage(); let clock = 0;
  const recorder = createSessionRecorder({ storage: s, now: () => 10000, elapsed: () => clock, id: () => id });
  expect(hasSessionConsent(s)).toBe(false);
  expect(recorder.record({ type: 'error' })).toBe(false);
  expect(s.getItem(SESSION_LOG_KEY)).toBe(null);
  setSessionConsent(s, true);
  expect(recorder.record({ type: 'error', kind: 'rejection', message: 'secret@example.com' })).toBe(true);
  recorder.flush(); expect(readSessions(s, 10000)[0].events).toEqual([{ at: 0, type: 'error', kind: 'rejection' }]);
  recorder.revoke(); expect(s.getItem(SESSION_LOG_KEY)).toBe(null);
  clock = 6000; expect(recorder.record({ type: 'click' })).toBe(false); expect(recorder.flush()).toBe(false);
});
test('allowlist removes secrets, identities, labels, URL seeds and nonfinite state', () => {
  const event = sanitizeSessionEvent({ at: 10, type: 'sample', minute: 42, mode: 'living', seed: 'email@example.com', camera: [1, 2, Infinity], target: [1, 2, 3], fps: NaN, maxFrameMs: 20, url: 'https://secret', name: 'person', message: 'token' });
  expect(event).toEqual({ at: 10, type: 'sample', minute: 42, seed: null, fps: null, maxFrameMs: 20, camera: null, target: [1, 2, 3], mode: 'living' });
  expect(sanitizeSessionEvent({ at: 0, type: 'click', kind: 'secret', x: -1, y: 0.123456, text: 'secret' })).toEqual({ at: 0, type: 'click', kind: 'other', x: null, y: 0.12 });
  expect(sanitizeSessionEvent({ at: 0, type: 'secret' })).toBe(null);
});
test('read prunes expired/future/corrupt sessions and revalidates tampered events', () => {
  const s = storage(), now = SESSION_TTL_MS + 1000;
  s.setItem(SESSION_LOG_KEY, JSON.stringify([{ version: 1, id, startedAt: 999, events: [] }, { version: 1, id, startedAt: now + 1, events: [] }, { version: 1, id, startedAt: now, name: 'secret', events: [{ type: 'error', at: 3, kind: 'javascript', message: 'token' }, { type: 'password', at: 0 }] }]));
  expect(readSessions(s, now)).toEqual([{ version: 1, id, startedAt: now, events: [{ type: 'error', at: 3, kind: 'javascript' }] }]);
  expect(s.getItem(SESSION_LOG_KEY)).not.toContain('secret'); expect(s.getItem(SESSION_LOG_KEY)).not.toContain('token');
  s.setItem(SESSION_LOG_KEY, '{broken'); expect(readSessions(s, now)).toEqual([]);
});
test('bounded recording and time-based replay never select future samples', () => {
  const s = storage(); setSessionConsent(s, true); let clock = 0;
  const recorder = createSessionRecorder({ storage: s, now: () => 1000, elapsed: () => clock, id: () => id });
  recorder.record({ type: 'sample', minute: 1 }); clock = 1000; recorder.record({ type: 'sample', minute: 2 });
  for (let i = 0; i < MAX_EVENTS; i++) recorder.record({ type: 'click' });
  recorder.flush(); const session = readSessions(s, 1000)[0]; expect(session.events).toHaveLength(MAX_EVENTS);
  expect(sessionFrameAt(session, 500).sample.minute).toBe(1); expect(sessionFrameAt(session, 1000).sample.minute).toBe(2);
  expect(recorder.record({ type: 'error' })).toBe(false);
});
test('blocked browser storage fails closed without breaking gameplay', () => {
  const s = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  expect(hasSessionConsent(s)).toBe(false); expect(setSessionConsent(s, true)).toBe(false); expect(readSessions(s)).toEqual([]);
  expect(createSessionRecorder({ storage: s }).record({ type: 'error' })).toBe(false);
});
test('duration and session-count ceilings bound retention', () => {
  const s = storage(); setSessionConsent(s, true); let clock = 0;
  for (let i = 0; i < 7; i++) {
    const recorder = createSessionRecorder({ storage: s, now: () => 10000, elapsed: () => clock, id: () => 'fps_' + i.toString(16).repeat(32) });
    recorder.record({ type: 'sample', minute: i }); clock += 1800001;
    expect(recorder.record({ type: 'sample', minute: i + 1 })).toBe(false);
    recorder.flush();
  }
  expect(readSessions(s, 10000)).toHaveLength(5);
  expect(readSessions(s, 10000)[0].events[0].minute).toBe(2);
});
