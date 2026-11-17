import { test, expect } from 'bun:test';
import { createEditHistory } from '../world/decision/edit-history.js';

test('five reversible edits, immutable snapshots, branch and unique revisions', () => {
  const receipt = { seed: 42, runId: 'stored', metrics: { homes: 60 } };
  const before = structuredClone(receipt);
  const draft = { parameters: { permitting: 18 }, seed: 42 };
  const history = createEditHistory(draft);
  expect(history.undo()).toBeNull(); expect(history.redo()).toBeNull();
  for (let i = 1; i <= 5; i++) { draft.parameters.permitting = i; history.record(draft); }
  for (let i = 4; i >= 0; i--) expect(history.undo().parameters.permitting).toBe(i || 18);
  expect(history.canUndo).toBe(false);
  for (let i = 1; i <= 5; i++) expect(history.redo().parameters.permitting).toBe(i);
  const revision = history.revision;
  const restored = history.undo(); restored.parameters.permitting = 99;
  history.record(restored);
  expect(history.canRedo).toBe(false); expect(history.revision).toBeGreaterThan(revision);
  expect(receipt).toEqual(before);
});
test('no-op, reset, bounded history and returned values cannot mutate retained revisions', () => {
  const history = createEditHistory({ n: 0 }, { limit: 5 });
  expect(history.record({ n: 0 })).toBe(false);
  for (let n = 1; n <= 20; n++) history.record({ n });
  for (let n = 19; n >= 15; n--) { const value = history.undo(); expect(value.n).toBe(n); value.n = -1; }
  expect(history.undo()).toBeNull(); expect(history.redo()).toEqual({ n: 16 });
  history.reset({ n: 100 }); expect(history.canUndo).toBe(false); expect(history.canRedo).toBe(false);
});

// Exercise the shipped editor's restore coordinator with its real history and draft
// collaborators, while keeping the model/result and replay authorities observable.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHousingScenarios, housingModel } from '../world/models/housing/index.js';
const source = readFileSync(new URL('../world/decision/studio.js', import.meta.url), 'utf8');
const coordinator = source.slice(source.indexOf('function editableSnapshot()'), source.indexOf('function validateInput('));
test('editor coordinator restores knobs and selection without touching receipts, seed or replay clock', () => {
  const nodes = new Map();
  for (const id of ['project-name','decision-text','run-count','run-years','run-seed']) nodes.set(`#${id}`, { value: id === 'run-seed' ? '42' : '10' });
  for (const id of ['undo-edit','redo-edit','edit-revision','legacy-model-banner','model-version','compile-report']) nodes.set(`#${id}`, { replaceChildren(){} });
  const receipt = Object.freeze({ id: 'prior-run', seed: 42, clock: 120, entityId: 'original' });
  const state = { scenarios: createHousingScenarios(), selected: 'plan-a', metadata: {}, evidence: [], needsCompile: false, readonly: false, busy: false, results: receipt };
  const context = { state, housingModel, activeModel: housingModel, clone: structuredClone, $: id => nodes.get(id), editHistory: null,
    restoringEdit: false, resolveHousingModel: () => ({ model: housingModel }), renderScenarios(){},
    clearTimeout, previewTimer: undefined, status(){}, markDirty(){}, };
  runInNewContext(coordinator + '\nthis.api={editableSnapshot,restoreEdit,updateEditHistory};', context);
  context.editHistory = createEditHistory(context.api.editableSnapshot());
  const original = state.scenarios[1].parameters.permitting_months;
  for (let i = 1; i <= 5; i++) { state.scenarios[1].parameters.permitting_months = i; context.editHistory.record(context.api.editableSnapshot()); }
  for (let i = 4; i >= 0; i--) { context.api.restoreEdit('undo'); expect(state.scenarios[1].parameters.permitting_months).toBe(i || original); }
  for (let i = 1; i <= 5; i++) { context.api.restoreEdit('redo'); expect(state.scenarios[1].parameters.permitting_months).toBe(i); }
  expect(state.results).toBe(receipt); expect(nodes.get('#run-seed').value).toBe('42'); expect(state.selected).toBe('plan-a');
  state.readonly = true; context.api.restoreEdit('undo'); expect(state.scenarios[1].parameters.permitting_months).toBe(5);
  context.api.updateEditHistory(); expect(nodes.get('#undo-edit').disabled).toBe(true);
  state.readonly = false; state.busy = true; context.api.restoreEdit('undo'); expect(state.scenarios[1].parameters.permitting_months).toBe(5);
});
