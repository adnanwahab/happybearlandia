import { ARCHETYPES } from './content.js';
export const MODEL_VERSION = '1.0.0';
export const FIELDS = [
  ['price', 'Selling price', 0.01, 1000000, '$ / unit'], ['unitCost', 'Unit input cost', 0, 1000000, '$ / unit'],
  ['quality', 'Product quality', 1, 100, '/ 100'], ['startingCash', 'Starting cash', 0, 1e9, '$'],
  ['capacity', 'Production / service capacity', 1, 100000, 'units / period'], ['baseTraffic', 'Addressable traffic', 1, 100000, 'people / period'],
  ['rent', 'Rent', 0, 1e7, '$ / period'], ['wage', 'Wage per employee', 0, 1e7, '$ / period'],
  ['repeatRate', 'Repeat purchase', 0, 1, 'share'], ['churnRate', 'Subscription churn', 0, 1, 'share'],
  ['startingAwareness', 'Starting awareness', .001, 1, 'share'], ['growth', 'Market growth', -.2, .2, '/ period'],
  ['leadTime', 'Inventory lead time', 0, 6, 'periods'], ['takeRate', 'Marketplace take rate', .01, 1, 'share'],
];
export const copy = value => JSON.parse(JSON.stringify(value));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function validateDefinition(def) {
  const errors = [];
  if (!def || typeof def !== 'object' || Array.isArray(def)) return { valid: false, errors: ['A BusinessDef object is required.'] };
  if (def.schemaVersion !== 'business-def.v1') errors.push('Unsupported BusinessDef schema.');
  if (!ARCHETYPES[def.archetype]) errors.push('Choose a supported archetype.');
  if (!['day', 'month'].includes(def.scale)) errors.push('Period must be day or month.');
  for (const key of ['id','name','unit']) if (typeof def[key] !== 'string' || !def[key].trim() || def[key].length > 100) errors.push(`${key} requires 1–100 characters.`);
  if (typeof def.description !== 'string' || def.description.length > 4000) errors.push('Description must be text up to 4000 characters.');
  for (const [id, label, min, max] of FIELDS) if (!finite(def[id]) || def[id] < min || def[id] > max) errors.push(`${label} must be ${min}–${max}.`);
  if (finite(def.unitCost) && finite(def.price) && def.unitCost >= def.price * (def.archetype === 'marketplace' ? def.takeRate : 1)) errors.push('Reference price must exceed effective unit cost.');
  if (!Number.isInteger(def.leadTime)) errors.push('Lead time must be a whole number.');
  if (!finite(def.perishability?.rate) || def.perishability.rate < 0 || def.perishability.rate > 1 || def.perishability.per !== 'period') errors.push('Perishability must be a per-period rate from 0–1.');
  const ref = def.referencePrice;
  if (![ref?.min,ref?.typical,ref?.max].every(v => finite(v) && v > 0) || ref.min > ref.typical || ref.typical > ref.max) errors.push('Reference prices must be positive and ordered.');
  if (!Array.isArray(def.demand?.seasonality) || def.demand.seasonality.length !== 12 || def.demand.seasonality.some(v => !finite(v) || v < .05 || v > 5) || !finite(def.demand?.weatherWeight) || def.demand.weatherWeight < 0 || def.demand.weatherWeight > 2) errors.push('Demand requires 12 seasonality weights (0.05–5) and weather weight (0–2).');
  const segments = def.segments;
  if (!Array.isArray(segments) || !segments.length || segments.length > 8) errors.push('Provide 1–8 customer segments.');
  else {
    const ids = new Set();
    for (const s of segments) {
      if (!s || typeof s.id !== 'string' || ids.has(s.id) || typeof s.label !== 'string' || s.label.length > 100) { errors.push('Segment IDs must be unique and labels must be text.'); continue; }
      ids.add(s.id);
      for (const key of ['share','budget','sensitivity','quality','patience','affinity']) if (!finite(s[key]) || s[key] <= 0 || s[key] > 20) errors.push(`Segment ${s.id}: invalid ${key}.`);
    }
  }
  if (!Array.isArray(def.channels) || def.channels.length !== 3 || def.channels.some((c, i) => !c || c.id !== ['social','creators','local'][i] || !finite(c.reach) || c.reach <= 0 || c.reach > 1000 || !finite(c.saturation) || c.saturation < 1 || c.saturation > 1e7 || !finite(c.conversion) || c.conversion <= 0 || c.conversion > 1)) errors.push('Three channels are required: social, creators, local, with bounded funnel assumptions.');
  if (!Array.isArray(def.inputs) || !def.inputs.length || def.inputs.length > 8 || def.inputs.some(i => !i || typeof i.id !== 'string' || !finite(i.cost) || i.cost < 0 || i.cost > 1e6 || !finite(i.quality) || i.quality < 0 || i.quality > 1)) errors.push('Inputs require bounded cost and quality.');
  if (!Array.isArray(def.recipe?.knobs) || def.recipe.knobs.length > 4 || def.recipe.knobs.some(k => typeof k !== 'string' || !/^[a-z][a-z0-9_-]{0,30}$/.test(k)) || !finite(def.recipe?.batchYield) || def.recipe.batchYield <= 0) errors.push('Recipe requires up to four named knobs and a positive yield.');
  if (!finite(def.production?.hours) || def.production.hours <= 0 || def.production.hours > 744 || !finite(def.production?.batchSize) || def.production.batchSize <= 0 || !finite(def.production?.minutes) || def.production.minutes <= 0) errors.push('Production needs positive batch size, time and hours (≤744).');
  if (!def.unlock || !['stand','cart','kiosk','storefront','chain'].includes(def.unlock.tier)) errors.push('Unlock tier must be stand, cart, kiosk, storefront or chain.');
  if (def.recipe?.ideal && Object.values(def.recipe.ideal).some(group => !group || typeof group !== 'object' || Object.values(group).some(v => !finite(v) || v < 0 || v > 10))) errors.push('Recipe ideals must be numeric values from 0–10.');
  if (def.fulfillment !== ARCHETYPES[def.archetype]?.constraint) errors.push('Fulfillment must match the archetype adapter.');
  return { valid: !errors.length, errors };
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function approveDefinition(draft, version = 1) {
  if (!Number.isInteger(version) || version < 1) throw new Error('Definition version must be a positive integer.');
  const checked = validateDefinition(draft);
  if (!checked.valid) throw new Error(checked.errors.join(' '));
  const result = copy(draft);
  result.version = version; result.approved = true;
  return freeze(result);
}
export function requireApproved(def) {
  if (!def?.approved || !Number.isInteger(def.version) || def.version < 1) throw new Error('Review and approve the BusinessDef before simulating.');
  const checked = validateDefinition(def); if (!checked.valid) throw new Error(checked.errors.join(' '));
}
