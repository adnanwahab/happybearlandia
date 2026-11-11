/** Pure comparisons of monthly City records. No geometry or cross-model IDs are inferred. */
export const ENTITY_KINDS = Object.freeze(['districts', 'parcels', 'buildings', 'units', 'households', 'workers', 'businesses', 'jobs', 'links', 'facilities', 'utilities', 'projects', 'policies']);

// A policy, project, unit occupancy, or capacity change alone is not a changed building.
const PHYSICAL_FIELDS = Object.freeze({
  buildings: ['floors', 'height', 'geometry', 'bbox', 'parcelId'],
  units: ['buildingId', 'floorArea', 'bedrooms'],
  links: ['geometry'], facilities: ['geometry'], utilities: ['geometry'],
});

function canonical(value) {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
const copy = value => value === undefined ? null : structuredClone(value);
const sorted = values => [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

function index(rows, kind) {
  if (!Array.isArray(rows)) return null;
  const result = new Map();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || result.has(row.id)) throw new Error(`Duplicate/missing ${kind} ID`);
    result.set(row.id, row);
  }
  return result;
}

/** Missing/nonfinite values remain null; a zero denominator does not create a percentage. */
export function metricDelta(baseline, plan, unit) {
  const a = Number.isFinite(baseline) ? baseline : null, b = Number.isFinite(plan) ? plan : null;
  const available = a !== null && b !== null && Number.isFinite(b - a);
  return {baseline: a, plan: b, delta: available ? b - a : null, unit,
    status: available ? 'available' : 'missing', missing: [a === null ? 'baseline' : null, b === null ? 'plan' : null, a !== null && b !== null && !available ? 'delta' : null].filter(Boolean)};
}

function anchor(kind, row, state) {
  if (!row) return null;
  if (kind === 'buildings') return row.id;
  const id = kind === 'households' ? state.units?.find(u => u.id === row.unitId)?.buildingId : row.buildingId;
  return typeof id === 'string' && state.buildings?.some(b => b.id === id) ? id : null;
}

/** Presence changes mean inventory differences between futures, never inferred births/deaths. */
export function compareEntities(baseline, plan) {
  const entities = {}, physicalChanges = [], nonphysicalChanges = [], missing = [];
  for (const kind of ENTITY_KINDS) {
    const a = index(baseline[kind], kind), b = index(plan[kind], kind);
    const group = entities[kind] = {status: a && b ? 'available' : 'missing', added: [], removed: [], modified: [], unchanged: 0};
    if (!a || !b) { missing.push({kind, sides: [!a ? 'baseline' : null, !b ? 'plan' : null].filter(Boolean)}); continue; }
    for (const id of sorted(new Set([...a.keys(), ...b.keys()]))) {
      const before = a.get(id), after = b.get(id);
      const type = !before ? 'added' : !after ? 'removed' : 'modified';
      const fields = before && after ? sorted(new Set([...Object.keys(before), ...Object.keys(after)])).filter(key => key !== 'id' && canonical(before[key]) !== canonical(after[key])).map(field => ({field, baseline: copy(before[field]), plan: copy(after[field]), baselinePresent: Object.hasOwn(before, field), planPresent: Object.hasOwn(after, field)})) : [];
      if (before && after && !fields.length) { group.unchanged++; continue; }
      const physicalFields = fields.filter(f => PHYSICAL_FIELDS[kind]?.includes(f.field) && f.baseline !== null && f.plan !== null);
      const physical = kind === 'buildings' && type !== 'modified' || physicalFields.length > 0;
      const change = {kind, id, type, physical, fields, physicalFields: physicalFields.map(f => f.field), baseline: copy(before), plan: copy(after),
        buildingIds: sorted(new Set([anchor(kind, before, baseline), anchor(kind, after, plan)].filter(Boolean)))};
      group[type].push(change);
      (physical ? physicalChanges : nonphysicalChanges).push(change);
    }
  }
  return {entities, physicalChanges, nonphysicalChanges, missing};
}

export function compareHouseholds(baseline, plan) {
  const a = index(baseline.households, 'households'), b = index(plan.households, 'households');
  if (!a || !b) return {status: 'missing', rows: []};
  return {status: 'available', identityAuthority: 'monthly-city', rows: sorted(new Set([...a.keys(), ...b.keys()])).map(id => {
    const before = a.get(id), after = b.get(id);
    const unitA = baseline.units?.find(u => u.id === before?.unitId), unitB = plan.units?.find(u => u.id === after?.unitId);
    return {id, status: !before ? 'plan-only' : !after ? 'baseline-only' : 'matched', baseline: copy(before), plan: copy(after),
      income: metricDelta(before?.income, after?.income, 'USD/month'), savings: metricDelta(before?.savings, after?.savings, 'USD stock'),
      rent: metricDelta(unitA?.rent, unitB?.rent, 'USD/month'),
      housing: {baseline: before ? {unitId: before.unitId ?? null, buildingId: anchor('households', before, baseline)} : null,
        plan: after ? {unitId: after.unitId ?? null, buildingId: anchor('households', after, plan)} : null}};
  })};
}

/** The caller supplies two states from the same recorded month and matched run. */
export function compareCityStates(baseline, plan) {
  if (!baseline || !plan || baseline.schemaVersion !== 'CityState.v1' || plan.schemaVersion !== 'CityState.v1') throw new Error('Two monthly CityState.v1 records required');
  if (!Number.isInteger(baseline.month) || baseline.month < 0 || baseline.month > 120 || baseline.month !== plan.month) throw new Error('Matched month 0–120 required');
  if (!Number.isInteger(baseline.seed) || baseline.seed < 0 || baseline.seed > 4294967295 || baseline.seed !== plan.seed || !baseline.version || baseline.version !== plan.version) throw new Error('Matched seed and model version required');
  const changes = compareEntities(baseline, plan);
  return {schemaVersion: 'future-machine-diff.v1', month: baseline.month, seed: baseline.seed, modelVersion: baseline.version,
    ...changes, households: compareHouseholds(baseline, plan),
    hasPhysicalChanges: changes.physicalChanges.length > 0,
    hasChanges: changes.physicalChanges.length + changes.nonphysicalChanges.length > 0,
    status: changes.missing.length ? 'partial' : 'available'};
}
