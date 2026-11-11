import {CONTRACT_VERSION, MODEL_VERSION, MONTHS, assertMonth} from '../contracts.js';

export const MAX_RECIPE_LENGTH = 2048;
const keys = ['schemaVersion','modelVersion','seed','households','months','intervention'];
const policyKeys = ['type','districtId','amount','cost','delay','compliance','utility'];
export class ShareError extends Error {
  constructor(code, message) { super(message); this.name = 'ShareError'; this.code = code; }
}
const fail = (code, message) => { throw new ShareError(code, message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
function exactKeys(value, allowed, required = allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value,key)))
    fail('INVALID_RECIPE', 'Recipe contains missing or unsupported parameters.');
}
/** The bounded synthetic generator is the only URL input source in v1. */
export function validateRecipe(recipe) {
  exactKeys(recipe, keys);
  if (recipe.schemaVersion !== CONTRACT_VERSION) fail('SCHEMA_MISMATCH', 'This Future Machine recipe version is unavailable.');
  if (recipe.modelVersion !== MODEL_VERSION) fail('MODEL_MISMATCH', 'This City model version is unavailable; the link cannot be silently upgraded.');
  if (!integer(recipe.seed,0,4294967295) || !integer(recipe.households,1,120) || recipe.months !== MONTHS)
    fail('INVALID_RECIPE', 'Use a uint32 seed, 1–120 households, and exactly 120 months.');
  let intervention = null;
  if (recipe.intervention !== null) {
    const p = recipe.intervention;
    exactKeys(p, policyKeys, ['type','districtId','amount','cost']);
    if (!['housing','transit','utility','school','resilience','upzone'].includes(p.type) || typeof p.districtId !== 'string' || !/^d[0-2]$/.test(p.districtId) ||
        !number(p.amount,Number.MIN_VALUE,100000) || !number(p.cost,0,1e12) ||
        (p.delay !== undefined && !integer(p.delay,0,120)) || (p.compliance !== undefined && !number(p.compliance,0,1)) ||
        (p.utility !== undefined && !['electric','water','sewer','stormwater'].includes(p.utility)))
      fail('INVALID_POLICY', 'Unsupported City policy or out-of-bounds policy parameters.');
    intervention = Object.fromEntries(policyKeys.filter(key => Object.hasOwn(p,key)).map(key => [key,p[key]]));
  }
  return {schemaVersion:CONTRACT_VERSION,modelVersion:MODEL_VERSION,seed:recipe.seed,households:recipe.households,months:MONTHS,intervention};
}
export function encodeRecipe(recipe) {
  const text = JSON.stringify(validateRecipe(recipe));
  // v1 is ASCII-only. Browser btoa/atob also run in Bun; no Node polyfill required.
  const result = btoa(text).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  if (result.length > MAX_RECIPE_LENGTH) fail('OVERSIZED_RECIPE','Future Machine recipe is too large.');
  return result;
}
export function decodeRecipe(encoded) {
  if (typeof encoded !== 'string' || encoded.length > MAX_RECIPE_LENGTH) fail('OVERSIZED_RECIPE','Future Machine recipe is missing or too large.');
  if (!encoded.length || !/^[A-Za-z0-9_-]+$/.test(encoded)) fail('MALFORMED_RECIPE','Malformed Future Machine recipe encoding.');
  let parsed;
  try { parsed = JSON.parse(atob(encoded.replaceAll('-','+').replaceAll('_','/'))); }
  catch { fail('MALFORMED_RECIPE','Malformed Future Machine recipe JSON.'); }
  const recipe = validateRecipe(parsed);
  if (encodeRecipe(recipe) !== encoded) fail('MALFORMED_RECIPE','Recipe encoding is not canonical.');
  return recipe;
}
function selectedMonth(month) {
  try { return assertMonth(month); } catch { fail('INVALID_MONTH','Selected month must be an integer from 0 through 120.'); }
}
function experimentId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^city_[\w-]{1,96}$/.test(value)) fail('INVALID_EXPERIMENT','Invalid saved City experiment identity.');
  return value;
}
export function createShareURL({recipe,experimentId: id,month},baseURL = globalThis.location?.href) {
  const url = new URL(baseURL);
  if (!['http:','https:'].includes(url.protocol)) fail('INVALID_URL','Share links require an HTTP or HTTPS URL.');
  url.searchParams.set('fm',encodeRecipe(recipe));
  url.searchParams.set('month',String(selectedMonth(month)));
  const saved = experimentId(id);
  url.searchParams.delete('experiment');
  if (saved) url.searchParams.set('experiment',saved);
  return url.href;
}
export function parseShareURL(input) {
  let url; try { url = new URL(input); } catch { fail('INVALID_URL','Invalid Future Machine URL.'); }
  const params = url.searchParams;
  if (!['fm','experiment','month'].some(key => params.has(key))) return null;
  if (!['http:','https:'].includes(url.protocol)) fail('INVALID_URL','Share links require an HTTP or HTTPS URL.');
  if (['fm','experiment','month'].some(key => params.getAll(key).length > 1)) fail('INVALID_URL','Duplicate Future Machine parameters.');
  if (!params.has('fm') || !params.has('month')) fail('MISSING_PARAMETER','A shared future requires its recipe and selected month.');
  const text = params.get('month');
  if (!/^(0|[1-9][0-9]{0,2})$/.test(text)) fail('INVALID_MONTH','Invalid selected month.');
  return {recipe:decodeRecipe(params.get('fm')),experimentId:experimentId(params.has('experiment') ? params.get('experiment') : null),month:selectedMonth(Number(text))};
}
/** Call after saved-record load, before displaying it as the linked run. */
export function assertHistoryIdentity(history, context) {
  const recipe = validateRecipe(history?.recipe);
  if (encodeRecipe(recipe) !== encodeRecipe(context.recipe) || history.modelVersion !== recipe.modelVersion || history.seed !== recipe.seed ||
      (context.experimentId && history.experimentId !== context.experimentId) || (context.initialHash && history.initialHash !== context.initialHash))
    fail('IDENTITY_MISMATCH','Saved future does not match the shared model, inputs, seed, policy, or run identity.');
  return history;
}
const LIMITATIONS = [
  'Modeled results from illustrative, uncalibrated monthly City rules are not empirical forecasts.',
  'Synthetic inventory and schematic layout are assumptions, not real geographic building locations.',
  'Replay recomputes the recorded manifest; equivalence to independently retained checkpoints has not been verified.',
  'A single matched seed is not an uncertainty distribution. Differences alone do not establish real-world causality.',
  'Entity identities are scoped to monthly City; no House or Population identity mapping is asserted.'
];
export function createEvidenceReport(history,{month = 120,diff = null,story = null} = {}) {
  selectedMonth(month);
  assertHistoryIdentity(history,{recipe:history?.recipe});
  if (typeof history.initialHash !== 'string' || !history.initialHash.length || history.initialHash.length > 256)
    fail('MISSING_PROVENANCE','Evidence export requires the initial-state digest.');
  for (const arm of ['baseline','plan']) {
    if (!Array.isArray(history[arm]) || history[arm].length !== 121 || Array.from({length:121},(_,index) => history[arm][index]).some((snapshot,index) => snapshot?.month !== index))
      fail('INCOMPLETE_HISTORY','Evidence export requires Month 0 through Month 120 in both futures.');
  }
  if (diff !== null && diff.month !== month) fail('MONTH_MISMATCH','Diff evidence must match the selected month.');
  const observations = Object.fromEntries(['baseline','plan'].map(arm => {
    const snapshot = history[arm][month];
    return [arm,{month,metrics:snapshot.metrics ?? null,events:snapshot.events ?? null,causalRecords:snapshot.causalRecords ?? null,decisions:snapshot.decisions ?? null}];
  }));
  const report = {
    schemaVersion:'future-machine-evidence.v1',authority:'monthly City',recipe:validateRecipe(history.recipe),
    experimentId:experimentId(history.experimentId),initialHash:history.initialHash,modelVersion:history.modelVersion,seed:history.seed,
    month,horizon:{firstMonth:0,lastMonth:120,steps:120},provenance:history.provenance ?? null,
    evidenceKind:'manifest-recomputation',observations,modeledComparison:diff,narrativeInterpretation:story,
    limitations:[...LIMITATIONS]
  };
  let json;
  try { json = JSON.stringify(report,(_key,value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) fail('INVALID_EVIDENCE','Evidence contains a non-finite measurement.');
    return value;
  }); } catch(error) { if (error instanceof ShareError) throw error; fail('INVALID_EVIDENCE','Evidence must be JSON serializable.'); }
  if (json.length > 4_000_000) fail('OVERSIZED_EVIDENCE','Selected-month evidence exceeds the 4 MB export limit.');
  return JSON.parse(json);
}
