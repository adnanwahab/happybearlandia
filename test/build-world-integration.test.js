import { afterEach, describe, expect, test } from 'bun:test';
import { housingModel, createHousingScenarios, simulateHousingRun, resolveHousingModel } from '../world/models/housing/index.js';
import { createBuildingProposal, validateBuildingPlacement } from '../world/buildings/proposal.js';
import { proposeWorldEdit } from '../world/ai/provider.js';
import { validateWorldEdit } from '../world/ai/edit-validator.js';
import { applyApprovedWorldEdit, undoWorldEdit, restoreWorldRevision } from '../world/ai/revisions.js';
import { createDecisionApiHandler } from '../world/decision/api.js';
import { createMemoryDecisionStore } from '../world/decision/store.js';
const handlers = [];
afterEach(async () => { while (handlers.length) await handlers.pop().close(); });
const input = () => ({ schemaVersion: 'decision-experiment.v1', name: 'Building edit acceptance', decision: 'Housing around transit', modelId: housingModel.id, modelVersion: housingModel.version, seed: 42, runs: 10, years: 10, scenarios: createHousingScenarios(), metadata: {} });
const requestProposal = world => proposeWorldEdit({ prompt: 'Build a 300-unit residential tower near the station, with 25% affordable housing.', worldState: world, scenario: world.scenarios[1], provider: 'demo', env: {} });
const math = (world, projects) => simulateHousingRun({ parameters: world.scenarios[1].parameters, seed: world.seed, years: world.years, projects: projects ?? world.scenarios[1].projects ?? [] });
const signature = result => ({ metrics: result.metrics, timeline: result.timeline, events: result.events, drivers: result.drivers, accounting: result.accounting });
async function apiSetup() {
  const handler = createDecisionApiHandler({ store: createMemoryDecisionStore() }); handlers.push(handler);
  return async (path = '', body) => {
    const response = await handler(new Request(`http://local/api/decision-experiments${path}`, { method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    const value = await response.json();
    expect(response.ok, JSON.stringify(value).slice(0, 500)).toBe(true);
    return value;
  };
}
async function execute(api, world) {
  const { experiment } = await api('', world); await api(`/${experiment.id}/start`, {});
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const result = await api(`/${experiment.id}/results`);
    if (['completed','failed','cancelled'].includes(result.experiment.status)) { expect(result.experiment.status).toBe('completed'); return result; }
    await Bun.sleep(5);
  }
  throw new Error('Building experiment did not finish');
}

describe('Build Something + Edit World integration', () => {
  test('rotated footprint placement checks actual overlap and optional district polygons', () => {
    const proposal = createBuildingProposal({ location: { x: 5, z: 0, rotation: Math.PI / 4 } });
    expect(validateBuildingPlacement(proposal, { buildings: [{ polygon: [{x:0,z:0},{x:20,z:0},{x:20,z:20},{x:0,z:20}] }] }).valid).toBe(false);
    expect(validateBuildingPlacement(proposal, { bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 } }).valid).toBe(false);
  });
  test('preview and reject are byte-pure; explicit approval produces audited immutable revision', async () => {
    const world = input(), bytes = JSON.stringify(world), proposal = await requestProposal(world);
    const checked = validateWorldEdit(proposal, { input: world, scenarioId: 'plan-a' });
    expect(checked.valid).toBe(true); expect(JSON.stringify(world)).toBe(bytes);
    for (const approval of [undefined, false, 'true', { approved: true }]) {
      const rejected = await applyApprovedWorldEdit({ input: world, proposal, scenarioId: 'plan-a', approval });
      expect(JSON.stringify(rejected.input)).toBe(bytes); expect(rejected.revision).toBeNull();
    }
    const applied = await applyApprovedWorldEdit({ input: world, proposal, scenarioId: 'plan-a', approval: true });
    expect(applied.input.scenarios[1].projects[0].status).toBe('approved');
    expect(applied.input.metadata.resultsStale).toBe(true);
    expect(applied.revision.parent).toBe('root'); expect(applied.revision.proposalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(applied.revision.provider).toBe('demo'); expect(applied.revision.prompt).toContain('300-unit');
    expect(Object.isFrozen(applied.revision)).toBe(true); expect(JSON.stringify(world)).toBe(bytes);
  });
  test('proposed and cancelled projects do not affect numerical results or shared random draws', () => {
    const world = input(), baseline = math(world);
    for (const status of ['proposed','cancelled']) {
      const draft = createBuildingProposal({ id: 'inactive_project', status });
      expect(signature(math(world, [draft]))).toEqual(signature(baseline));
    }
  });
  test('approved project consumes capacity, pays actual subsidy, completes once and replays identically', async () => {
    const world = input(), proposal = await requestProposal(world);
    const approved = await applyApprovedWorldEdit({ input: world, proposal, scenarioId: 'plan-a', approval: true });
    const first = math(approved.input), second = math(approved.input);
    expect(first.projects).toEqual(second.projects);
    const project = first.projects[0], states = project.states;
    expect(states).toHaveLength(121);
    expect(new Set(states.map(state => state.status)).size).toBeGreaterThan(4);
    expect(states.some(state => state.floorsBuilt > 0 && state.floorsBuilt < 24)).toBe(true);
    expect(first.projectMetrics.capacityUsed).toBeGreaterThan(0);
    expect(first.projectMetrics.completedUnits).toBe(300);
    expect(first.projectMetrics.publicCost).toBeGreaterThan(0);
    expect(first.projectMetrics.publicCost).toBeLessThanOrEqual(proposal.operations[0].value.finance.publicSubsidy);
    expect(states.at(-1).completedUnits).toBe(300);
    expect(first.accounting.projectCompletedHomes).toBe(300);
    expect(first.metrics.housing_supply).not.toBe(math(world).metrics.housing_supply);
    expect(project.events.filter(event => event.type === 'PROJECT_COMPLETED')).toHaveLength(1);
  });
  test('remove, undo, restore and stale detection retain original common-random-number results', async () => {
    const world = input(), baseline = math(world), proposal = await requestProposal(world);
    const built = await applyApprovedWorldEdit({ input: world, proposal, scenarioId: 'plan-a', approval: true });
    await expect(applyApprovedWorldEdit({ input: built.input, proposal, scenarioId: 'plan-a', approval: true })).rejects.toThrow('Stale');
    const removal = { schemaVersion: 'world-edit.v1', summary: 'Remove project', operations: [{ op: 'remove_building', target: built.input.scenarios[1].projects[0].id }], warnings: [], baseRevision: built.revision.id };
    const removed = await applyApprovedWorldEdit({ input: built.input, proposal: removal, scenarioId: 'plan-a', approval: true });
    expect(signature(math(removed.input))).toEqual(signature(baseline));
    const undone = await undoWorldEdit({ input: built.input, approval: true });
    expect(signature(math(undone.input))).toEqual(signature(baseline));
    expect(undone.input.metadata.worldEditHistory).toHaveLength(2);
    const restored = await restoreWorldRevision({ input: undone.input, revisionId: built.revision.id, approval: true });
    expect(math(restored.input).projects).toEqual(math(built.input).projects);
    expect(restored.input.metadata.worldEditHistory).toHaveLength(3);
    expect(built.input.metadata.worldEditHistory).toHaveLength(1);
  });
  test('visual-only approved revisions do not change seeds, parameters, or output metrics', async () => {
    const world = input(), before = math(world);
    const proposal = await proposeWorldEdit({ prompt: 'Make the downtown towers taller', worldState: world, scenario: world.scenarios[1], provider: 'demo', env: {} });
    const visual = await applyApprovedWorldEdit({ input: world, proposal, scenarioId: 'plan-a', approval: true });
    expect(visual.revision.requiresSimulationRerun).toBe(false);
    expect(visual.input.seed).toBe(world.seed);
    expect(visual.input.scenarios[1].parameters).toEqual(world.scenarios[1].parameters);
    expect(signature(math(visual.input))).toEqual(signature(before));
  });
  test('project states and approved AI audit survive API share, manifests and exact reproduction', async () => {
    const api = await apiSetup(), world = input(), proposal = await requestProposal(world);
    const approved = await applyApprovedWorldEdit({ input: world, proposal, scenarioId: 'plan-a', approval: true });
    const completed = await execute(api, approved.input);
    expect(completed.runs.find(row => row.scenarioId === 'plan-a').projects[0].states.length).toBe(121);
    const share = await api(`/${completed.experiment.id}/share`);
    expect(share.readOnly).toBe(true);
    expect(share.experiment.metadata.worldRevision.id).toBe(approved.revision.id);
    const manifest = await api(`/${completed.experiment.id}/manifest`);
    expect(manifest.experiment.metadata.worldEditHistory[0].provider).toBe('demo');
    const rerun = await execute(api, { manifest });
    expect(rerun.runs.map(row => ({ seed: row.seed, metrics: row.metrics, projects: row.projects }))).toEqual(completed.runs.map(row => ({ seed: row.seed, metrics: row.metrics, projects: row.projects })));
    const visualProposal = await proposeWorldEdit({ prompt: 'Make the downtown towers taller', worldState: approved.input, scenario: approved.input.scenarios[1], provider: 'demo', env: {} });
    const visual = await applyApprovedWorldEdit({ input: approved.input, proposal: visualProposal, scenarioId: 'plan-a', approval: true });
    const savedVisual = await api(`/${completed.experiment.id}/visual-revision`, { input: visual.input });
    expect(savedVisual.experiment.status).toBe('completed');
    expect(savedVisual.experiment.id).not.toBe(completed.experiment.id);
    const visualShare = await api(`/${savedVisual.experiment.id}/share`);
    expect(visualShare.experiment.scenarios[1].worldVisuals.heightScale).toBe(1.2);
    expect(visualShare.experiment.metadata.worldRevision.id).toBe(visual.revision.id);
    expect(visualShare.runs.map(row => ({seed:row.seed,metrics:row.metrics,projects:row.projects}))).toEqual(completed.runs.map(row => ({seed:row.seed,metrics:row.metrics,projects:row.projects})));
    const later = await undoWorldEdit({ input: approved.input, approval: true });
    expect(later.input.metadata.worldRevision.id).not.toBe(approved.revision.id);
    expect((await api(`/${completed.experiment.id}/results`)).runs).toEqual(completed.runs);
  }, 30000);
  test('frozen housing 1.0.0 manifests keep their old numerical resolver after new drafts', async () => {
    const old = resolveHousingModel('1.0.0'), world = input();
    expect(old.model.version).toBe('1.0.0');
    const original = old.simulateRun({ parameters: world.scenarios[1].parameters, seed:42, years:10 });
    math(world, [createBuildingProposal({ status: 'approved' })]);
    expect(old.simulateRun({ parameters: world.scenarios[1].parameters, seed:42, years:10 })).toEqual(original);
    expect(() => old.simulateRun({ projects: [createBuildingProposal()], seed:42, years:10 })).toThrow();
    const api = await apiSetup();
    const complete = await execute(api, { ...world, modelVersion: '1.0.0' });
    expect(complete.model.version).toBe('1.0.0');
    expect((await api(`/${complete.experiment.id}/manifest`)).modelVersion).toBe('1.0.0');
  }, 30000);
});
