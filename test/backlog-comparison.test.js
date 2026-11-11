import { test, expect } from 'bun:test';
import { pairedHousingScene } from '../world/decision/backlog-comparison/model.js';
import { simulateHousingRun, createHousingScenarios } from '../world/models/housing/index.js';
import { createBuildingProposal } from '../world/buildings/proposal.js';
function fixture(change = false) {
  const parameters = createHousingScenarios()[0].parameters;
  const project = createBuildingProposal({ id: 'comparison-tower', status: 'approved' });
  const make = (id, scenarioId, projects) => ({ ...simulateHousingRun({ parameters, seed: 0, years: 10, projects }), id, scenarioId, seed: 0, status: 'completed' });
  const baseline = make('base-0', 'base', []), selected = make('plan-0', 'plan', change ? [project] : []);
  return { results: { model: { id: 'housing.v1', version: '1.2.0' }, experiment: { scenarios: [{ id: 'base', kind: 'baseline' }, { id: 'plan', kind: 'plan-a' }] }, runs: [baseline, selected] }, selectedRun: selected };
}
test('zero control uses actual seed-matched records without mutation', () => {
  const input = fixture(), before = structuredClone(input);
  for (const month of [0, 12, 120, 0]) { const pair = pairedHousingScene({ ...input, month }); expect(pair.available).toBe(true); expect(pair.supplyDelta).toBe(0); expect(pair.arms[0].vacancy).toBe(pair.arms[1].vacancy); }
  expect(input).toEqual(before);
});
test('nonzero stock and construction derive from same records and reverse exactly', () => {
  const input = fixture(true), end = pairedHousingScene({ ...input, month: 120 });
  expect(end.supplyDelta).not.toBe(0);
  expect(end.arms[1].projects[0].state).toEqual(input.selectedRun.projects[0].states.find(row => row.month === 120));
  expect(end.arms[1].supply).toBe(input.selectedRun.monthlyTimeline[120].metrics.housing_supply);
  const start = pairedHousingScene({ ...input, month: 0 });
  expect(start.arms[1].projects[0].state.completedUnits).toBe(0); expect(start.supplyMax).toBe(end.supplyMax);
  expect(pairedHousingScene({ ...input, month: 120 })).toEqual(end);
});
test('missing months and metrics remain missing; zero vacancy remains zero', () => {
  const input = fixture(true); input.selectedRun.monthlyTimeline.splice(12, 1);
  const pair = pairedHousingScene({ ...input, month: 12 });
  expect(pair.arms[1].available).toBe(false); expect(pair.arms[1].supply).toBeNull(); expect(pair.arms[1].projects).toEqual([]); expect(pair.supplyDelta).toBeNull();
  input.selectedRun.monthlyTimeline[0].metrics.vacancy_rate = 0; expect(pairedHousingScene(input).arms[1].vacancy).toBe(0);
  delete input.selectedRun.monthlyTimeline[0].metrics.vacancy_rate; expect(pairedHousingScene(input).arms[1].vacancy).toBeNull();
});
test('rejects incompatible identities, versions, unfinished runs and invalid time', () => {
  for (const mutate of [i => i.selectedRun.seed = 1, i => i.selectedRun.modelVersion = '99', i => i.results.model.id = 'population', i => i.selectedRun.status = 'running']) {
    const input = fixture(); mutate(input); expect(pairedHousingScene(input).available).toBe(false);
  }
  for (const month of [-1, .5]) expect(pairedHousingScene({ ...fixture(), month }).available).toBe(false);
});
