import { expect, test } from 'bun:test';
import { recordedBeat } from '../world/hidden-systems/choreography.js';
import { compareHiddenSystems } from '../world/hidden-systems/model.js';

test('only exact recorded milestones animate; any delay suppresses cosmetic work', () => {
  const event = (eventType, simulationTime = 5, projectId = 'p') => ({ eventType, simulationTime, payload: { projectId } });
  const project = { id: 'p', events: [event('TOPPED_OUT')] };
  expect(recordedBeat({ month: 5 }, project)?.label).toBe('Topping out');
  expect(recordedBeat({ month: 6 }, project)).toBeNull();
  expect(recordedBeat({ month: 5 }, { ...project, id: 'other' })).toBeNull();
  for (const type of ['MATERIAL_DELAY', 'CAPACITY_DELAY', 'IMPLEMENTATION_DELAY', 'CAPITAL_PROJECT_DELAYED']) {
    expect(recordedBeat({ month: 5 }, { ...project, events: [...project.events, event(type)] })).toBeNull();
  }
  expect(recordedBeat(null, null)).toBeNull();
  expect(recordedBeat({}, { id: 'p', events: [event('TOPPED_OUT', undefined)] })).toBeNull();
  expect(recordedBeat({ month: 0 }, { id: 'p' })).toBeNull();
});

test('real monthly replay gates delay months and exposes model cost without mutation', () => {
  const comparison = compareHiddenSystems();
  const before = structuredClone(comparison);
  let milestones = 0;
  for (const arm of [comparison.baseline, comparison.adjusted]) for (const snapshot of arm) {
    for (const project of snapshot.projects) {
      expect(Number.isFinite(project.cost)).toBe(true);
      expect(Number.isFinite(project.costOverrun)).toBe(true);
      const beat = recordedBeat(snapshot, project);
      if (project.events.some(event => /DELAY/.test(event.eventType))) expect(beat).toBeNull();
      if (beat) milestones++;
    }
  }
  expect(milestones).toBeGreaterThan(0);
  expect(comparison).toEqual(before);
});
