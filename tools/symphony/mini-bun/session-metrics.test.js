import { test, expect } from 'bun:test';
import { summarizeSession } from './session-metrics.js';
const START = Date.parse('2026-11-13T00:00:00Z'), HOUR = 3600000;
function event(seq, elapsedMs, phase = 'working', type = 'heartbeat', rest = {}) {
  return { schemaVersion: 1, sessionId: 'session-a', seq, at: new Date(START + elapsedMs).toISOString(), elapsedMs, phase, type, ...rest };
}
function observedRun(durationMs, phase = 'working') {
  const result = [event(0, 0, phase, 'session_started')];
  for (let elapsed = 60000; elapsed < durationMs; elapsed += 60000) result.push(event(result.length, elapsed, phase));
  result.push(event(result.length, durationMs, phase)); return result;
}
test('25-hour exact boundary requires persisted coverage, distinct from wall-clock age', () => {
  const below = summarizeSession(observedRun(25 * HOUR - 1), { now: START + 26 * HOUR });
  expect(below.reachedRuntimeTarget).toBe(false); expect(below.reachedCodingTarget).toBe(false); expect(below.status).toBe('stale');
  const exact = summarizeSession(observedRun(25 * HOUR), { now: START + 25 * HOUR });
  expect(exact.continuousObservedMs).toBe(25 * HOUR); expect(exact.codingMs).toBe(25 * HOUR);
  expect(exact.reachedRuntimeTarget).toBe(true); expect(exact.reachedCodingTarget).toBe(true); expect(exact.status).toBe('running');
});
test('25 hours idle may verify runtime, but never coding or output', () => {
  const result = summarizeSession(observedRun(25 * HOUR, 'waiting'), { now: START + 25 * HOUR });
  expect(result.reachedRuntimeTarget).toBe(true); expect(result.reachedCodingTarget).toBe(false);
  expect(result.waitingMs).toBe(25 * HOUR); expect(result.codingMs).toBe(0); expect(result.prsCreated).toBe(0); expect(result.status).toBe('waiting');
});
test('missing heartbeats and crashes never receive inferred credit; later coverage starts a new span', () => {
  const result = summarizeSession([event(0, 0, 'working', 'session_started'), event(1, 60000), event(2, 10 * HOUR), event(3, 10 * HOUR + 60000)], { now: START + 11 * HOUR });
  expect(result.observedMs).toBe(120000); expect(result.continuousObservedMs).toBe(60000); expect(result.currentContinuousObservedMs).toBe(60000);
  expect(result.unknownMs).toBe(10 * HOUR - 60000); expect(result.gaps).toBe(1); expect(result.status).toBe('stale');
});
test('phase intervals use previous phase and wall activity is a union, not per-worker duration', () => {
  const events = [event(0, 0, 'starting', 'session_started'), event(1, 1000, 'working', 'phase_changed'), event(2, 1000, 'working', 'task_started', { taskId: 'A', details: { attempt: 1 } }), event(3, 1000, 'working', 'task_started', { taskId: 'B', details: { attempt: 1 } }), event(4, 31000, 'publishing', 'phase_changed'), event(5, 41000, 'waiting', 'phase_changed'), event(6, 51000, 'syncing', 'phase_changed'), event(7, 61000, 'stopped', 'session_stopped', { details: { reason: 'SIGINT' } })];
  const result = summarizeSession(events, { now: START + HOUR });
  expect(result.observedMs).toBe(61000); expect(result.codingMs).toBe(30000); expect(result.publishingMs).toBe(10000); expect(result.waitingMs).toBe(10000); expect(result.syncingMs).toBe(10000); expect(result.otherObservedMs).toBe(1000);
  expect(result.tasksStarted).toBe(2); expect(result.status).toBe('stopped'); expect(result.unknownMs).toBe(0);
  expect(result.codingMs + result.publishingMs + result.waitingMs + result.syncingMs + result.otherObservedMs + result.unknownMs).toBe(result.elapsedMs);
});
test('malformed, duplicated and out-of-order observations do not inflate durations', () => {
  const first = event(0, 0, 'working', 'session_started'), last = event(1, 60000);
  const result = summarizeSession([null, '{broken', first, first, last, event(0, 90000), event(2, -1)], { now: START + 60000 });
  expect(result.elapsedMs).toBe(60000); expect(result.codingMs).toBe(60000); expect(result.invalidEvents).toBe(5);
});
test('missing sequence numbers are uncertain even within the heartbeat budget', () => {
  const result = summarizeSession([event(0, 0, 'working', 'session_started'), event(2, 10000), event(3, 20000)], { now: START + 20000 });
  expect(result.unknownMs).toBe(10000); expect(result.observedMs).toBe(10000); expect(result.continuousObservedMs).toBe(10000);
});
test('wall-clock regressions cannot inflate monotonic elapsed durations', () => {
  const result = summarizeSession([event(0, 0, 'working', 'session_started'), event(1, 30000, 'working', 'heartbeat', { at: new Date(START - HOUR).toISOString() }), event(2, 60000)], { now: START + 60000 });
  expect(result.codingMs).toBe(60000); expect(result.elapsedMs).toBe(60000); expect(result.clockRegressions).toBe(1);
});
test('restarts are not combined and truncated prefixes remain unknown', () => {
  const result = summarizeSession([event(0, 0, 'working', 'session_started'), event(1, 60000), event(0, 0, 'working', 'session_started', { sessionId: 'session-b' }), event(1, 60000, 'working', 'heartbeat', { sessionId: 'session-b' })], { now: START + 60000 });
  expect(result.codingMs).toBe(60000); expect(result.foreignEvents).toBe(2); expect(result.sessionId).toBe('session-a');
  const truncated = summarizeSession([event(5, 60000), event(6, 120000)], { now: START + 120000, targetMs: 60000 });
  expect(truncated.unknownMs).toBe(60000); expect(truncated.observedMs).toBe(60000); expect(truncated.startedAt).toBeNull(); expect(truncated.reachedRuntimeTarget).toBe(false);
});
test('counts final task outcomes once, excludes reused PR receipts, and does not equate exit zero with acceptance', () => {
  const events = [event(0, 0, 'working', 'session_started'), event(1, 1000, 'working', 'task_started', { taskId: 'A', details: { attempt: 1 } }), event(2, 2000, 'publishing', 'worker_finished', { taskId: 'A', details: { code: 0 } }), event(3, 3000, 'publishing', 'pr_created', { taskId: 'A', details: { url: 'https://github.com/example/repo/pull/1' } }), event(4, 4000, 'working', 'task_finished', { taskId: 'A', details: { attempt: 1, status: 'pr_created', code: 0 } }), event(5, 5000, 'working', 'task_finished', { taskId: 'A', details: { attempt: 1, status: 'pr_created', code: 0 } }), event(6, 6000, 'working', 'pr_created', { details: { url: 'https://github.com/example/repo/pull/1' } }), event(7, 7000, 'working', 'pr_created', { details: { url: 'https://github.com/example/repo/pull/2', reused: true } }), event(8, 8000, 'working', 'task_finished', { taskId: 'B', details: { attempt: 1, status: 'no_changes', code: 0 } }), event(9, 9000, 'working', 'task_finished', { taskId: 'C', details: { attempt: 1, status: 'failed', code: 1 } }), event(10, 10000, 'working', 'publish_failed'), event(11, 11000, 'working', 'operator_intervention')];
  const result = summarizeSession(events, { now: START + 11000 });
  expect(result.tasksStarted).toBe(1); expect(result.tasksFinished).toBe(3); expect(result.prsCreated).toBe(1); expect(result.failed).toBe(1); expect(result.noChanges).toBe(1); expect(result.publicationFailures).toBe(1); expect(result.interventions).toBe(1);
  expect(result.limits.some(text => text.includes('not accepted implementation'))).toBe(true);
});
test('no evidence, invalid options, stopped suffixes and future timestamps stay bounded', () => {
  expect(summarizeSession([]).status).toBe('no_evidence');
  const result = summarizeSession([event(0, 0, 'working', 'session_started'), event(1, 1000, 'stopped', 'session_stopped'), event(2, 60000)], { now: START + 1000, targetMs: -1, heartbeatMaxGapMs: NaN });
  expect(result.elapsedMs).toBe(1000); expect(result.hasStop).toBe(true); expect(result.invalidEvents).toBe(1); expect(result.targetMs).toBe(25 * HOUR);
  expect(summarizeSession([event(0, 0, 'working', 'session_started')], { now: START - 1 }).status).toBe('stale');
});
