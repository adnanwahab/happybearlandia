import {VERSION} from './contracts.js';

export const DISTRICT_GRID_VERSION = 'city-district-grid.v1';
const text = value => typeof value === 'string' && value.length > 0;
const identity = value => JSON.stringify(value);
function scopeKey(scope) {
  if (!scope || !text(scope.runId) || !text(scope.initialHash) || scope.modelVersion !== VERSION ||
      !Number.isInteger(scope.seed) || scope.seed < 0 || scope.seed > 0xffffffff) {
    throw new TypeError('District grid requires runId, initialHash, supported modelVersion and uint32 seed');
  }
  return identity([scope.runId, scope.initialHash, scope.modelVersion, scope.seed]);
}
function districtIds(districts) {
  if (!Array.isArray(districts) || districts.length > 1024) throw new TypeError('Invalid district inventory');
  const ids = districts.map(row => row?.id);
  if (!ids.every(text) || new Set(ids).size !== ids.length) throw new TypeError('Ambiguous district identity');
  return ids;
}

/** One district context tile per initial district; coordinates are never geography. */
export function createDistrictGrid({scope, districts}) {
  const expectedScope = scopeKey(scope);
  const provenance = Object.freeze({runId: scope.runId, initialHash: scope.initialHash, modelVersion: scope.modelVersion, seed: scope.seed});
  const cells = districtIds(districts).sort().map((districtId, index) => Object.freeze({
    cellId: identity([DISTRICT_GRID_VERSION, expectedScope, districtId]), districtId,
    row: Math.floor(index / 4), column: index % 4,
    mapping: 'synthetic-district-context', geographicCoverage: 'unsupported',
  }));
  const byDistrict = new Map(cells.map(cell => [cell.districtId, cell]));
  return Object.freeze({
    schemaVersion: DISTRICT_GRID_VERSION,
    cells: Object.freeze(cells),
    /** measurements use existing districtHeatmap's exact district `id`; no name/position joins. */
    project(state, {scope: frameScope, measurements}) {
      if (scopeKey(frameScope) !== expectedScope || state?.version !== VERSION || state.seed !== frameScope.seed ||
          !Number.isInteger(state.month) || state.month < 0) throw new TypeError('Incompatible district checkpoint');
      const present = new Set(districtIds(state.districts));
      if (!Array.isArray(measurements)) throw new TypeError('Missing district measurements');
      const measured = new Map();
      for (const record of measurements) {
        if (!text(record?.id) || measured.has(record.id) ||
            !(record.value === null || Number.isFinite(record.value))) throw new TypeError('Invalid district measurement');
        measured.set(record.id, record);
      }
      const rows = cells.map(cell => {
        const record = measured.get(cell.districtId);
        const status = !present.has(cell.districtId) ? 'district_absent' : !record ? 'measurement_missing' : record.value === null ? 'measurement_unavailable' : 'available';
        return {...cell, month: state.month, status, value: status === 'available' ? record.value : null,
          measurement: record ? structuredClone(record) : null};
      });
      const unlocated = [...new Set([...present, ...measured.keys()])].filter(id => !byDistrict.has(id) || !present.has(id)).sort().map(districtId => ({
        districtId, reason: !present.has(districtId) ? 'district_absent' : 'district_not_in_initial_inventory',
        measurement: measured.has(districtId) ? structuredClone(measured.get(districtId)) : null,
      }));
      return {schemaVersion: DISTRICT_GRID_VERSION, scope: {...provenance}, month: state.month,
        label: 'Synthetic district context schematic; no geographic or per-cell measurement attribution.', rows, unlocated};
    },
  });
}
