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

test('keyboard inspection emits exact stored provenance and destroy removes the mounted view', async () => {
  const { mountHousingComparison } = await import('../world/decision/backlog-comparison/view.js');
  class Element extends EventTarget {
    constructor(doc) { super(); this.ownerDocument = doc; this.children = []; this.attrs = {}; this.style = {}; }
    setAttribute(key, value) { this.attrs[key] = value; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  class DetailEvent extends Event { constructor(type, options) { super(type, options); this.detail = options.detail; } }
  const doc = { defaultView: { CustomEvent: DetailEvent, innerWidth: 320 } }; doc.createElement = () => new Element(doc); doc.createElementNS = () => new Element(doc);
  const container = new Element(doc), inspected = [], input = fixture(true);
  const view = mountHousingComparison(container, { onInspect: detail => inspected.push(detail) });
  view.update({ ...input, month: 120 });
  const root = container.children[0], emitted = [];
  expect(root.children[3].attrs.viewBox).toBe('0 0 400 760');
  expect(root.children[3].children[1].attrs.transform).toBe('translate(0 380)'); root.addEventListener('housing-comparison:inspect', event => emitted.push(event.detail));
  const walk = el => [el, ...el.children.flatMap(walk)];
  const project = walk(root).find(el => el.attrs['data-project-id'] === 'comparison-tower');
  const key = new Event('keydown', { cancelable: true }); Object.defineProperty(key, 'key', { value: 'Enter' }); project.dispatchEvent(key);
  expect(key.defaultPrevented).toBe(true);
  expect(inspected).toEqual([{ runId: input.selectedRun.id, projectId: 'comparison-tower', month: 120, state: input.selectedRun.projects[0].states[120] }]);
  expect(emitted).toEqual(inspected);
  view.destroy(); expect(container.children).toEqual([]); view.update(input); expect(container.children).toEqual([]);
});

test('paired hydration uses only exact baseline seed/version and tolerates missing or stale loads', async () => {
  const { hydrateComparisonBaseline } = await import('../world/decision/backlog-comparison/hydration.js');
  const input = fixture(true); input.results.experiment.id = 'saved-housing';
  const calls = [], loadRun = async (...args) => { calls.push(args); return input.results.runs[0]; };
  expect((await hydrateComparisonBaseline({ ...input, loadRun })).id).toBe('base-0');
  expect(calls).toEqual([['saved-housing', 'base-0']]);
  expect(await hydrateComparisonBaseline({ ...input, loadRun: async () => { throw Error('network'); } })).toBeNull();
  let current = true;
  expect(await hydrateComparisonBaseline({ ...input, isCurrent: () => current, loadRun: async () => { current = false; return input.results.runs[0]; } })).toBeNull();
  input.results.runs[0].seed = 9;
  expect(await hydrateComparisonBaseline({ ...input, loadRun })).toBeNull(); expect(calls).toHaveLength(1);
});
