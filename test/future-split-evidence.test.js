import { describe, expect, test } from 'bun:test';
import { describeMilestones, entityHistory, metricDifference } from '../world/future-split/evidence.js';

describe('Future Split evidence', () => {
  test('deltas retain sign and distinguish zero from unavailable measurements', () => {
    expect(metricDifference(12, 9)).toBe(-3);
    expect(metricDifference(12, 12)).toBe(0);
    expect(metricDifference(0, 12)).toBe(12);
    expect(metricDifference(12, null)).toBeNull();
    expect(metricDifference(undefined, 0)).toBeNull();
    expect(metricDifference(Infinity, 0)).toBeNull();
  });

  test('milestones group simultaneous first observations and skip repeated entity change categories', () => {
    const frames = [
      { month: 2, changes: [] },
      { month: 3, changes: [{ kind: 'project', status: 'added' }, { kind: 'route', status: 'modified' }] },
      { month: 4, changes: [{ kind: 'project', status: 'added' }] },
      { month: 5, changes: [{ kind: 'building', status: 'added' }] },
    ];
    expect(describeMilestones({ firstDivergenceMonth: 3, frames })).toEqual([
      { month: 3, labels: ['First divergence', 'New project', 'Changed route'] },
      { month: 5, labels: ['New building'] },
    ]);
    expect(describeMilestones({ firstDivergenceMonth: null, frames: frames.slice(0, 1) })).toEqual([]);
  });

  test('history matches exact City IDs and preserves absent and unchanged months', () => {
    const other = { id: 'building:1', fields: { rent: 9 } };
    const target = { id: 'building:10', fields: { rent: 0 } };
    const added = { id: target.id, status: 'added' };
    const removed = { id: target.id, status: 'removed' };
    const frame = (month, before, after, changes = []) => ({
      month, baseline: { entities: before }, intervention: { entities: after }, changes,
    });
    const frames = [
      frame(2, [other], [other]),
      frame(3, [other], [target, other], [added]),
      frame(4, [target], [target]),
      frame(5, [target], [other], [removed]),
    ];
    expect(entityHistory(frames, target.id)).toEqual([
      { month: 2, baseline: undefined, intervention: undefined, status: null },
      { month: 3, baseline: undefined, intervention: target, status: 'added' },
      { month: 4, baseline: target, intervention: target, status: null },
      { month: 5, baseline: target, intervention: undefined, status: 'removed' },
    ]);
  });
});
