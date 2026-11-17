import { buildingFootprint, SQFT_TO_SQM } from '../../buildings/proposal.js';
import { checkDraft } from './model.js';

// Offsets translate the existing square footprint; they never invent parcel data.
export function previewBoundary(drafts, id, offsets = { x: 0, z: 0 }) {
  const source = drafts.find(row => row.id === id);
  if (!source || source.schemaVersion !== 'building-proposal.v1') {
    return { valid: false, errors: ['Unsupported boundary: a building-proposal.v1 identity is required.'], warnings: [], polygon: null, drafts: null, areaSqFt: null, areaSqM: null, heightMeters: null };
  }
  if (![offsets.x, offsets.z].every(Number.isFinite)) {
    return { valid: false, errors: ['Offsets must be finite meters.'], warnings: [], polygon: null, drafts: null, areaSqFt: null, areaSqM: null, heightMeters: null };
  }
  const proposed = structuredClone(drafts);
  const selected = proposed.find(row => row.id === id);
  selected.location.x += offsets.x;
  selected.location.z += offsets.z;
  const validation = checkDraft(proposed);
  return { ...validation, polygon: buildingFootprint(selected), drafts: validation.valid ? proposed : null,
    areaSqFt: selected.geometry.footprintSqFt, areaSqM: selected.geometry.footprintSqFt * SQFT_TO_SQM,
    heightMeters: selected.geometry.heightMeters };
}
