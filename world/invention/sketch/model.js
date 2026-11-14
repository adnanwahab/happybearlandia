import { normalizePlan, POLICY_CATALOG, runPlan } from '../model.js';

export const SKETCH_VERSION = 'city-street-sketch.v1';
export const GRID = 20;
export function snapPoint(x, y) {
  if (![x, y].every(Number.isFinite)) throw new Error('Coordinates must be finite.');
  return [x, y].map(value => Math.round(Math.max(0, Math.min(300, value)) / GRID) * GRID);
}
// Schematic coordinates have no geographic scale. District strips are authored UI assumptions.
export function validateSketch(input) {
  if (!input || input.version !== SKETCH_VERSION) throw new Error('Unsupported sketch version.');
  if (input.kind !== 'transit') throw new Error('New road network edits are unsupported and cannot run.');
  const points = input.points;
  if (!Array.isArray(points) || points.length < 2 || points.length > 32 || points.some(point =>
    !Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value) || value < 0 || value > 300 || value % GRID))) {
    throw new Error('Draw 2–32 snapped points inside the schematic.');
  }
  if (points.some((point, index) => index && point.every((value, axis) => value === points[index - 1][axis]))) throw new Error('Consecutive points must differ.');
  const district = x => `d${Math.min(2, Math.floor(x / 100))}`;
  const districtId = district(points[0][0]);
  if (points.some(point => district(point[0]) !== districtId)) throw new Error('Cross-district network edits are unsupported. Keep the sketch within one district.');
  const policy = POLICY_CATALOG.find(row => row.id === input.policyId && row.type === 'transit' && row.districtId === districtId);
  if (!policy) throw new Error('Choose a supported transit capacity option for the drawn district.');
  if (input.cost !== policy.cost) throw new Error('Cost must match the versioned catalog assumption.');
  const plan = normalizePlan({ seed: input.seed, months: input.months, policies: [policy.id] });
  return { version: SKETCH_VERSION, kind: 'transit', points: points.map(point => [...point]), policyId: policy.id,
    cost: policy.cost, units: 'illustrative USD', geometryRole: 'schematic-only', plan };
}
export function runSketch(input) {
  const proposal = validateSketch(input); // Reject before advancing either arm.
  return { proposal, baseline: runPlan({ ...proposal.plan, policies: [] }), alternative: runPlan(proposal.plan) };
}
