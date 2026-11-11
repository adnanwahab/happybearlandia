import { DEFAULT_RECIPE, CONTRACT_VERSION, MODEL_VERSION, MONTHS, assertMonth } from '../contracts.js';
import { addIntervention, createEngine } from '../../city/engine.js';
import { createCity } from '../../city/seed.js';
import { checkCancelled, checkInitial, frame, freeze, stateHash } from './core.js';

export function validateRecipe(input = DEFAULT_RECIPE) {
  if (!input || Array.isArray(input) || typeof input !== 'object' || input.schemaVersion !== CONTRACT_VERSION || input.modelVersion !== MODEL_VERSION) throw new Error('Unsupported Future Machine recipe/model version');
  if (input.months !== MONTHS || !Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff || !Number.isInteger(input.households) || input.households < 1 || input.households > 120) throw new Error('Invalid seed, population or 120-month horizon');
  const intervention = input.intervention == null ? null : structuredClone(input.intervention);
  if (intervention) {
    const keys = ['type','districtId','amount','cost','delay','compliance','utility'];
    if (Object.keys(intervention).some(key => !keys.includes(key))) throw new Error('Unknown intervention field');
    addIntervention(createCity({ seed: input.seed, households: input.households }), intervention);
    if (intervention.type === 'housing' && intervention.amount > 120) throw new Error('Housing intervention exceeds 120 homes');
    if ((intervention.delay ?? 0) > 120) throw new Error('Intervention delay exceeds horizon');
  }
  return { schemaVersion: CONTRACT_VERSION, modelVersion: MODEL_VERSION, seed: input.seed, households: input.households, months: MONTHS, intervention };
}

// Versioned synthetic generator: keep this identical for creation and validation.
export function initialForRecipe(input = DEFAULT_RECIPE) {
  const recipe = validateRecipe(input);
  const state = createCity({ seed: recipe.seed, households: recipe.households });
  for (const parcel of state.parcels) parcel.capacity = 0;
  for (const utility of state.utilities) utility.capacity = 200;
  state.parameters.annualGrowth = 0;
  state.provenance = { ...state.provenance, datasetVersion: 'future-machine-synthetic.v1',
    assumptions: ['Synthetic City inventory; no geographic coordinates.', 'Private parcel capacity is zero; utilities have capacity 200 per district/network; annual growth is zero.', 'Illustrative monthly equations, not an empirical forecast.'] };
  return createEngine().initialize(state);
}
function snapshot(state, step, spending) {
  const recorded = frame(state, step || {});
  return { month: state.month, ...recorded, causalRecords: step?.causalRecords || [], metrics: { ...recorded.metrics, capitalSpending: spending } };
}
export function normalizeReplay(initial, replay) {
  checkInitial(initial);
  if (!Array.isArray(replay?.steps) || replay.steps.length !== MONTHS) throw new Error('Missing replay states: expected 120 steps');
  let spending = 0;
  const result = [snapshot(structuredClone(initial), null, 0)];
  for (const [index, step] of replay.steps.entries()) {
    if (!step.state || step.state.month !== index + 1 || step.state.seed !== initial.seed || step.state.version !== MODEL_VERSION) throw new Error('Missing or mismatched replay state');
    // Validate assignments as well as clock; missing inventory must never become zero.
    checkReplayState(step.state);
    const capital = step.state.systems.finance?.capitalExpense;
    if (!Number.isFinite(capital)) throw new Error('Missing monthly finance capital ledger');
    spending += capital;
    result.push(snapshot(step.state, step, spending));
  }
  return result;
}
function checkReplayState(state) {
  const originalMonth = state.month;
  checkInitial({ ...state, month: 0 });
  assertMonth(originalMonth);
}
async function historyFrom(record, baselineReplay, planReplay) {
  const { manifest } = record;
  const initial = manifest.initial;
  const recipe = recipeFromManifest(manifest);
  const initialHash = await stateHash(initial);
  if (initialHash !== await stateHash(initialForRecipe(recipe))) throw new Error('Saved initial state does not match versioned synthetic generator');
  return freeze({ schemaVersion: CONTRACT_VERSION, recipe, experimentId: record.id, initialHash, modelVersion: MODEL_VERSION, seed: initial.seed,
    baseline: normalizeReplay(initial, baselineReplay), plan: normalizeReplay(initial, planReplay),
    provenance: { ...structuredClone(initial.provenance), modelManifest: manifest.modelManifest, initialHash, replay: 'Recomputed from saved City manifest; not independently verified recorded checkpoints.', assumptions: manifest.assumptions, authority: 'monthly City only' } });
}
function recipeFromManifest(manifest) {
  if (!manifest || manifest.version !== MODEL_VERSION || manifest.months !== MONTHS || manifest.runs !== 1) throw new Error('Unsupported saved experiment version or horizon');
  checkInitial(manifest.initial);
  const scenarios = manifest.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length !== 2 || scenarios[0].id !== 'baseline' || scenarios[1].id !== 'plan' || scenarios[0].interventions?.length !== 0 || !Array.isArray(scenarios[1].interventions) || scenarios[1].interventions.length > 1) throw new Error('Saved experiment is not a matched Future Machine pair');
  const recipe = validateRecipe({ ...DEFAULT_RECIPE, seed: manifest.initial.seed, households: manifest.initial.households.length, intervention: scenarios[1].interventions[0] ?? null });
  if (JSON.stringify(manifest.modelManifest) !== JSON.stringify(createEngine().manifest)) throw new Error('Recorded system versions unavailable');
  return recipe;
}
async function operation(options, work) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(abort, 180000);
  const request = async (path, body) => {
    checkCancelled(controller.signal);
    const response = await fetch(path, { signal: controller.signal, ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
    const data = await response.json();
    checkCancelled(controller.signal);
    if (!response.ok) throw new Error(data.error || `City request failed (${response.status})`);
    return data;
  };
  const pause = () => new Promise((resolve, reject) => {
    checkCancelled(controller.signal);
    const cancelled = () => { clearTimeout(id); reject(new DOMException('Run cancelled', 'AbortError')); };
    const id = setTimeout(() => { controller.signal.removeEventListener('abort', cancelled); resolve(); }, 250);
    controller.signal.addEventListener('abort', cancelled, { once: true });
  });
  try { return await work(request, pause); }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
async function load(id, request, pause, onProgress) {
  if (!/^city_[\w-]{1,100}$/.test(id)) throw new Error('Invalid experiment ID');
  let record;
  while (true) {
    record = await request(`/api/city-experiments/${id}`);
    onProgress?.({ status: record.status, message: `City pair: ${record.completed ?? 0}/2 runs` });
    if (record.status === 'complete') break;
    if (!['queued','running'].includes(record.status)) throw new Error(record.error || `City experiment ${record.status}`);
    await pause();
  }
  recipeFromManifest(record.manifest);
  // Sequential replays respect the existing server's two-job limit.
  const baseline = await request(`/api/city-experiments/${id}/replay`, { scenarioId: 'baseline', runIndex: 0 });
  const plan = await request(`/api/city-experiments/${id}/replay`, { scenarioId: 'plan', runIndex: 0 });
  return historyFrom({ ...record, id }, baseline, plan);
}
export function createExperiment(input = DEFAULT_RECIPE, options = {}) {
  const recipe = validateRecipe(input);
  return operation(options, async (request, pause) => {
    options.onProgress?.({ status: 'creating', message: 'Forking matched monthly City futures' });
    const { id } = await request('/api/city-experiments', { title: 'Future Machine — synthetic housing pair', initial: initialForRecipe(recipe), runs: 1, months: MONTHS, retention: 'summary', scenarios: [{ id: 'baseline', interventions: [] }, { id: 'plan', interventions: recipe.intervention ? [recipe.intervention] : [] }] });
    return load(id, request, pause, options.onProgress);
  });
}
export function loadExperiment(id, options = {}) {
  return operation(options, (request, pause) => load(id, request, pause, options.onProgress));
}
export function getFrame(history, month) {
  assertMonth(month);
  return { month, baseline: history?.baseline?.[month] ?? null, plan: history?.plan?.[month] ?? null };
}
