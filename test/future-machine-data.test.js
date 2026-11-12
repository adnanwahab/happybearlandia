import { test, expect } from 'bun:test';
import { createEngine, addIntervention } from '../world/city/engine.js';
import { DEFAULT_RECIPE } from '../world/future-machine/contracts.js';
import { createExperiment, loadExperiment, validateRecipe, initialForRecipe, normalizeReplay, getFrame } from '../world/future-machine/data/index.js';
import { stateHash, freeze } from '../world/future-machine/data/core.js';

function replay(initial, intervention) {
  let state = intervention ? addIntervention(initial, intervention) : structuredClone(initial);
  const engine = createEngine(), steps = [];
  for (let i = 0; i < 120; i++) { const step = engine.step(state); steps.push(step); state = step.state; }
  return { steps };
}
test('default pair has identical original Month 0, exact 120 steps and deterministic replay', async () => {
  const initial = initialForRecipe();
  const before = await stateHash(initial);
  freeze(initial);
  const start = performance.now();
  const baseline = replay(initial), plan = replay(initial, DEFAULT_RECIPE.intervention);
  const a = normalizeReplay(initial, baseline), b = normalizeReplay(initial, plan);
  console.log(`Future Machine preset: ${Math.round(performance.now() - start)} ms pair; ${JSON.stringify({baseline:a,plan:b}).length} JSON bytes`);
  expect(a).toHaveLength(121); expect(b).toHaveLength(121);
  expect(a[0]).toEqual(b[0]); expect(a[120].state.month).toBe(120);
  expect(b[120].state.units.length).toBeGreaterThan(a[120].state.units.length);
  expect(await stateHash(initial)).toBe(before);
  expect(await stateHash(replay(initial, DEFAULT_RECIPE.intervention))).toBe(await stateHash(plan));
  expect(replay(initial)).toEqual(baseline);
  expect(b[120].metrics.capitalSpending).toBeGreaterThan(0);
  expect(getFrame({ baseline:a, plan:b },120).plan).toBe(b[120]);
});
test('strict versions, missing inventory, horizon and frame boundaries', async () => {
  for (const months of [0,119,121]) expect(() => validateRecipe({...DEFAULT_RECIPE,months})).toThrow();
  expect(() => validateRecipe({...DEFAULT_RECIPE,modelVersion:'old'})).toThrow();
  expect(() => validateRecipe({...DEFAULT_RECIPE,households:121})).toThrow();
  expect(() => validateRecipe({...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,delay:121}})).toThrow();
  const initial = initialForRecipe();
  expect(() => normalizeReplay(initial, {steps:[]})).toThrow('Missing replay');
  const run = replay(initial); run.steps[3].state = null;
  expect(() => normalizeReplay(initial,run)).toThrow('Missing');
  expect(() => getFrame({},-1)).toThrow(); expect(() => getFrame({},121)).toThrow();
  expect(getFrame({},0)).toEqual({month:0,baseline:null,plan:null});
  expect(await stateHash({b:2,a:1})).toBe(await stateHash({a:1,b:2}));
});
test('API adapter persists paired seeds, normalizes replay and handles cancellation/errors', async () => {
  const realFetch = globalThis.fetch;
  let manifest, calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    const body = options?.body ? JSON.parse(options.body) : null;
    if (url === '/api/city-experiments') {
      manifest = { ...body, version:DEFAULT_RECIPE.modelVersion, modelManifest:createEngine().manifest };
      return Response.json({id:'city_test'});
    }
    if (url.endsWith('/replay')) return Response.json(replay(manifest.initial,body.scenarioId === 'plan' ? manifest.scenarios[1].interventions[0] : null));
    return Response.json({id:'city_test',status:'complete',manifest});
  };
  try {
    const history = await createExperiment();
    expect(history.experimentId).toBe('city_test');
    expect(history.initialHash).toHaveLength(64);
    expect(Object.isFrozen(history.baseline[0].state)).toBe(true);
    expect(history.baseline[0]).toEqual(history.plan[0]);
    expect(history.baseline[120].state.seed).toBe(history.plan[120].state.seed);
    expect(calls).toHaveLength(4);
    const aborted = new AbortController(); aborted.abort();
    await expect(loadExperiment('city_test',{signal:aborted.signal})).rejects.toThrow('cancelled');
    manifest.version = 'old';
    await expect(loadExperiment('city_test')).rejects.toThrow('version');
    globalThis.fetch = async () => Response.json({error:'City unavailable'},{status:503});
    await expect(loadExperiment('city_test')).rejects.toThrow('City unavailable');
  } finally { globalThis.fetch = realFetch; }
});

test('real City API persists and reopens the exact 120-month pair', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { CityStore } = await import('../world/city/storage.js');
  const { createCityApi } = await import('../world/city/api.js');
  const root = mkdtempSync(join(tmpdir(),'future-machine-'));
  const store = new CityStore(root), handle = createCityApi({store});
  const realFetch = globalThis.fetch;
  globalThis.fetch = (path, options) => handle(new Request(`http://localhost${path}`,options));
  try {
    const start = performance.now();
    const history = await createExperiment();
    console.log(`Future Machine persisted API pair + replay: ${Math.round(performance.now()-start)} ms`);
    const reopened = await loadExperiment(history.experimentId);
    expect(reopened).toEqual(history);
    expect(history.baseline).toHaveLength(121);
    expect(history.plan[120].metrics.housingUnits-history.baseline[120].metrics.housingUnits).toBe(24);
    expect(history.plan[120].metrics.capitalSpending).toBe(1000000);
    expect(history.baseline[0].causalRecords).toEqual([]);
  } finally { globalThis.fetch = realFetch; store.close(); rmSync(root,{recursive:true,force:true}); }
},15000);


test('normalization preserves completion provenance and rejects a missing capital ledger', () => {
  const initial = initialForRecipe(), run = replay(initial, DEFAULT_RECIPE.intervention);
  const normalized = normalizeReplay(initial, run);
  const completion = normalized[16].events.find(event => event.eventType === 'PROJECT_COMPLETE');
  expect(completion).toEqual(run.steps[15].events.find(event => event.eventType === 'PROJECT_COMPLETE'));
  expect(completion).toMatchObject({id:'16-0', simulationTime:16, system:'construction',
    geographyId:'d1', modelVersion:DEFAULT_RECIPE.modelVersion,
    payload:{projectId:'project-policy-1-0',type:'housing',units:24}});
  expect(normalized[16].state.projects.find(project => project.id === completion.payload.projectId))
    .toMatchObject({policyId:'policy-1-0',stage:'completion',units:24});
  expect(normalized.every(snapshot => snapshot.causalRecords.length === 0)).toBe(true);
  delete run.steps[0].state.systems.finance.capitalExpense;
  expect(() => normalizeReplay(initial,run)).toThrow('Missing monthly finance capital ledger');
});

test('deadline reports actionable timeout and caller abort remains cancellation', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, {signal}) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once:true});
  });
  try {
    await expect(loadExperiment('city_timeout', {timeoutMs:10})).rejects.toThrow('City data timed out');
    const controller = new AbortController();
    const pending = loadExperiment('city_cancel', {signal:controller.signal});
    controller.abort();
    await expect(pending).rejects.toThrow('Aborted');
  } finally { globalThis.fetch = realFetch; }
});


test('lost connection is actionable without masking application failures', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await expect(loadExperiment('city_offline')).rejects.toThrow('City data connection interrupted. Check your connection and retry');
    globalThis.fetch = async () => ({json:async()=>{throw new TypeError('body stream lost');}});
    await expect(loadExperiment('city_interrupted')).rejects.toThrow('City data connection interrupted');
    globalThis.fetch = async () => Response.json({error:'Try again later'}, {status:503});
    await expect(loadExperiment('city_unavailable')).rejects.toThrow('Try again later');
    globalThis.fetch = async () => Response.json({id:'city_poll',status:'running'});
    await expect(loadExperiment('city_poll', {onProgress(){throw new TypeError('progress bug');}})).rejects.toThrow('progress bug');
  } finally { globalThis.fetch = realFetch; }
});
