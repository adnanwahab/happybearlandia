import { test, expect } from 'bun:test';
import { generateCoverageReport, measureRun, summarize } from '../scripts/why-receipt-coverage.js';
import { initialForRecipe } from '../world/future-machine/data/index.js';

test('counts distinct identities and transitions separately; empty is unavailable', () => {
  const rows = [{collection:'units', id:'x', receipts:['1-0']}, {collection:'units', id:'x', receipts:[]}, {collection:'jobs', id:'x', receipts:[]}];
  expect(summarize(rows)).toEqual({changedEntities:2, coveredEntities:1, entityCoverage:0.5, transitions:3, coveredTransitions:1, transitionCoverage:1/3});
  expect(summarize([]).entityCoverage).toBeNull();
  expect(summarize([]).transitionCoverage).toBeNull();
});

test('all field updates, additions and removals count; exact same-month receipts deduplicate', () => {
  const initial = initialForRecipe();
  const state = structuredClone(initial);
  state.month++;
  state.households[0].savings++;
  state.buildings.pop();
  state.buildings.push({id:'new', floors:1});
  const id = state.households[0].id;
  const event = {id:'1-0', simulationTime:1, eventType:'EXAMPLE', payload:{householdId:id}};
  const step = {state, events:[event, event, {...event, id:'wrong-month', simulationTime:2}, {...event, id:'wrong-id', payload:{householdId:'other'}}]};
  const rows = measureRun(initial, [step], 'plan');
  expect(rows).toHaveLength(3);
  expect(rows.find(r => r.collection === 'households').receipts).toEqual(['1-0']);
  expect(rows.filter(r => r.collection === 'buildings').map(r => r.kind).sort()).toEqual(['added','removed']);
  expect(summarize(rows).coveredEntities).toBe(1);
  expect(measureRun(initial, [{state, events:[]}], 'baseline').every(r => !r.receipts.length)).toBe(true);
  const missing = structuredClone(state);
  delete missing.units;
  expect(() => measureRun(initial, [{state:missing, events:[]}], 'plan')).toThrow('Missing entity inventory');
  expect(() => measureRun(initial, [{state:{...state, month:2}, events:[]}], 'plan')).toThrow('mismatched');
});

test('six real runs replay deterministically and retain flagship construction receipt', async () => {
  const a = await generateCoverageReport();
  expect(await generateCoverageReport()).toEqual(a);
  expect(a.runs).toHaveLength(6);
  for (const run of a.runs) {
    expect(run.byChangeType.reduce((n,r) => n+r.transitions,0)).toBe(run.transitions);
    expect(run.byChangeType.reduce((n,r) => n+r.coveredTransitions,0)).toBe(run.coveredTransitions);
    expect(run.byChangeType).toHaveLength(39);
    expect(run.recipe.months).toBe(120);
  }
  const plan = a.runs.find(r => r.seed === 42 && r.arm === 'plan');
  expect(plan.constructionExample.receipts).toContain('16-0');
  expect(plan.constructionExample.kind).toBe('added');
  expect(a.runs.find(r => r.seed === 42 && r.arm === 'baseline').constructionExample).toBeNull();
  const committed = await Bun.file(new URL('../docs/evidence/why-receipt-coverage.json', import.meta.url)).json();
  expect(a).toEqual(committed);
});
