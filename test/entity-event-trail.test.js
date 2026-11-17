import { test, expect } from 'bun:test';
import { createWorldCausalScenario } from '../world/causal/scenario.js';
import { entityMonthEvents } from '../world/causal/history.js';
import { cityEntityId } from '../world/causal/demo.js';
import { housingProjectBuildingId } from '../world/city/contracts.js';

test('selected entity trail retains genuine same-month inputs and transitions only', () => {
  const scenario = createWorldCausalScenario();
  for (let i = 0; i < 20; i++) scenario.step();
  const { events, edges, context } = scenario.snapshot();
  for (const type of ['EMPLOYMENT_MATCHED', 'HOUSEHOLD_RELOCATED', 'LINK_AVAILABILITY_CHANGED']) {
    const output = events.find(event => event.type === type);
    const entityId = output.entityIds[0];
    const foreign = { ...output, id: 'foreign', context: { ...output.context, runId: 'other' } };
    const trail = entityMonthEvents([...events, foreign], context, output.context.tick, entityId);
    expect(trail).toContain(output);
    expect(trail.some(event => event.id === 'foreign')).toBe(false);
    const edge = edges.find(edge => edge.toId === output.id);
    expect(trail.some(event => event.id === edge.fromId)).toBe(true);
    expect(trail.every(event => event.context.tick === output.context.tick)).toBe(true);
    expect(entityMonthEvents(events, context, 0, entityId)).toEqual([]);
  }
  const source = events.find(event => event.type === 'PROJECT_COMPLETE' && event.payload.source.payload.type === 'housing');
  const building = cityEntityId(context.worldId, 'building', housingProjectBuildingId(source.payload.source.payload.projectId));
  const trail = entityMonthEvents(events, context, source.context.tick, building);
  expect(trail.map(event => event.type)).toEqual(['PROJECT_COMPLETED']);
  expect(events).toContain(trail[0]);
  expect(edges.some(edge => edge.toId === trail[0].id)).toBe(true);
  expect(entityMonthEvents(events, context, source.context.tick + 1, building)).toEqual([]);
});
