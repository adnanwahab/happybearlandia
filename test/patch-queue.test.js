import { expect, test } from 'bun:test';
import { buildReadyQueue } from '../ops/patch-voting/queue.js';
const closed = id => ({ id, open: false, closesAt: '2026-01-01T00:00:00.000Z', score: 9, upvotes: 9 });
test('only curated tasks with completed prerequisites and closed successful votes enter READY', () => {
  const ballot = [closed('U06'), closed('U08'), closed('random-public-suggestion')];
  const a = buildReadyQueue(ballot, { now: Date.parse('2026-11-11T12:00:00Z') });
  expect(a.tasks).toHaveLength(0);
  expect(a.skipped.some(x => x.taskId === 'U06' && x.reason.includes('R02'))).toBe(true);
  const b = buildReadyQueue(ballot, { now: Date.parse('2026-11-11T12:00:00Z'), verifiedTaskIds: ['R01','R02','R05'] });
  expect(b.tasks.map(task => task.taskId)).toEqual(['U06','U08']);
  expect(b.tasks[0].source).toBe('maintainer-curated-vote');
  expect(b.tasks.some(task => task.taskId === 'random-public-suggestion')).toBe(false);
});
test('open, unpopular, already-running or verified tasks are not dispatched', () => {
  const ballot = [closed('U06'), { ...closed('U08'), open: true }];
  const result = buildReadyQueue(ballot, { now: Date.parse('2026-11-11T12:00:00Z'), verifiedTaskIds: ['R01','R02','R05'], activeTaskIds: ['U06'] });
  expect(result.tasks).toEqual([]);
  expect(result.skipped.some(x => x.taskId === 'U06' && x.reason === 'already assigned')).toBe(true);
});
