import { normalizePlan, POLICY_CATALOG, PLAN_MODEL_VERSION } from '../model.js';
import { QUEST_SCENARIO_VERSION } from '../../living-city/quests.js';

export const BLUEPRINT_VERSION = 'neighborhood-blueprint.v1';
export const MAX_BLUEPRINT_BYTES = 8192;
export const PALETTES = Object.freeze(['natural', 'brick', 'pastel']);
// Exact identities in the authored Riverside fixture; no geographic equivalence inferred.
export const PARCELS = Object.freeze(['parcel-d0', 'parcel-d1', 'parcel-d2']);
const policies = new Map(POLICY_CATALOG.map(row => [row.id, row]));
const units = { currency: 'USD', time: 'month', housing: 'unit', transit: 'model-capacity-unit', zoning: 'capacity-unit' };

function shape(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) {
    throw new Error(`Invalid ${name} fields.`);
  }
}

export function validateBlueprint(input) {
  shape(input, ['version', 'modelVersion', 'scenarioVersion', 'source', 'units', 'edits', 'cosmetics'], 'blueprint');
  if (input.version !== BLUEPRINT_VERSION || input.modelVersion !== PLAN_MODEL_VERSION ||
      input.scenarioVersion !== QUEST_SCENARIO_VERSION) throw new Error('Unsupported blueprint, model or scenario version.');
  shape(input.source, ['seed', 'months', 'startMonth', 'kind'], 'source');
  if (input.source.startMonth !== 2 || input.source.kind !== 'synthetic') throw new Error('Unsupported source checkpoint.');
  shape(input.units, Object.keys(units), 'units');
  if (Object.keys(units).some(key => input.units[key] !== units[key])) throw new Error('Unsupported units.');
  if (!Array.isArray(input.edits) || input.edits.length > 9 ||
      !Array.isArray(input.cosmetics) || input.cosmetics.length > PARCELS.length) throw new Error('Blueprint exceeds edit bounds.');
  const edits = input.edits.map(edit => {
    shape(edit, ['parcelId', 'policyId'], 'edit');
    if (!PARCELS.includes(edit.parcelId)) throw new Error('Unsupported parcel.');
    const policy = policies.get(edit.policyId);
    if (!policy || edit.parcelId !== `parcel-${policy.districtId}`) throw new Error('Unsupported policy or parcel mapping.');
    return { parcelId: edit.parcelId, policyId: edit.policyId };
  });
  const plan = normalizePlan({ seed: input.source.seed, months: input.source.months, policies: edits.map(edit => edit.policyId) });
  // Required source numbers must not use normalizePlan's editor defaults.
  if (input.source.seed !== plan.seed || input.source.months !== plan.months) throw new Error('Invalid source settings.');
  const seen = new Set();
  const cosmetics = input.cosmetics.map(choice => {
    shape(choice, ['parcelId', 'palette'], 'cosmetic');
    if (!PARCELS.includes(choice.parcelId)) throw new Error('Unsupported parcel.');
    if (!PALETTES.includes(choice.palette) || seen.has(choice.parcelId)) throw new Error('Invalid or duplicate cosmetic choice.');
    seen.add(choice.parcelId);
    return { parcelId: choice.parcelId, palette: choice.palette };
  });
  return {
    version: BLUEPRINT_VERSION, modelVersion: PLAN_MODEL_VERSION, scenarioVersion: QUEST_SCENARIO_VERSION,
    source: { seed: plan.seed, months: plan.months, startMonth: 2, kind: 'synthetic' }, units: { ...units },
    edits: edits.sort((a, b) => a.policyId < b.policyId ? -1 : a.policyId > b.policyId ? 1 : 0),
    cosmetics: cosmetics.sort((a, b) => a.parcelId < b.parcelId ? -1 : a.parcelId > b.parcelId ? 1 : 0),
  };
}

export function createBlueprint(planInput = {}, cosmetics = []) {
  const plan = normalizePlan(planInput);
  return validateBlueprint({
    version: BLUEPRINT_VERSION, modelVersion: PLAN_MODEL_VERSION, scenarioVersion: QUEST_SCENARIO_VERSION,
    source: { seed: plan.seed, months: plan.months, startMonth: 2, kind: 'synthetic' }, units,
    edits: plan.policies.map(policyId => ({ parcelId: `parcel-${policies.get(policyId).districtId}`, policyId })), cosmetics,
  });
}

export function encodeBlueprint(input) { return JSON.stringify(validateBlueprint(input), null, 2); }
export function decodeBlueprint(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BLUEPRINT_BYTES) throw new Error('Blueprint must be at most 8192 UTF-8 bytes.');
  let input;
  try { input = JSON.parse(text); } catch { throw new Error('Invalid blueprint JSON.'); }
  return validateBlueprint(input);
}
export function blueprintPlan(input) {
  const blueprint = validateBlueprint(input);
  return normalizePlan({ ...blueprint.source, policies: blueprint.edits.map(edit => edit.policyId) });
}

// Preview and confirmation both validate. Replacement avoids stacking repeated imports.
export function previewImport(text, current) {
  const blueprint = decodeBlueprint(text);
  return { blueprint, duplicate: encodeBlueprint(blueprint) === encodeBlueprint(current) };
}
export function confirmImport(text) { return decodeBlueprint(text); }
