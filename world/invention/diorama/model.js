import { createBuildingProposal, validateBuildingPlacement } from '../../buildings/proposal.js';
import { simulateHousingRun } from '../../models/housing/index.js';

export const BLOCK = Object.freeze({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });
export const CONTEXT = Object.freeze({ version: 'block-diorama.v1', modelVersion: '1.2.0', seed: 42, years: 10 });
export function initialMiniatures() {
  return [-50, 50].map((x, i) => createBuildingProposal({
    id: `block-home-${i + 1}`, name: `Miniature ${i + 1}`, location: { x, z: 0, districtId: null },
  }));
}
export function checkDraft(drafts) {
  const errors = [];
  const warnings = new Set();
  const ids = new Set();
  if (!Array.isArray(drafts) || !drafts.length || drafts.length > 64) return { valid: false, errors: ['Choose 1–64 buildings.'], warnings: [] };
  for (const draft of drafts) {
    if (ids.has(draft.id)) errors.push('Duplicate building identity.');
    ids.add(draft.id);
    const result = validateBuildingPlacement(draft, { bounds: BLOCK, buildings: drafts.filter(other => other !== draft) });
    errors.push(...result.errors);
    result.warnings.forEach(warning => warnings.add(warning));
  }
  return { valid: !errors.length, errors: [...new Set(errors)], warnings: [...warnings] };
}
// No simulation runs during select/move/rotate. The only approval boundary is here.
export function confirmBlock(drafts) {
  const validation = checkDraft(drafts);
  if (!validation.valid) return { ...validation, run: null };
  const projects = drafts.map(draft => ({ ...structuredClone(draft), status: 'approved' }));
  return { ...validation, run: simulateHousingRun({ seed: CONTEXT.seed, years: CONTEXT.years, projects }) };
}
export function baselineBlock() {
  return simulateHousingRun({ seed: CONTEXT.seed, years: CONTEXT.years, projects: [] });
}
