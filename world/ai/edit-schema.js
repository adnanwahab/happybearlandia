/** Browser-safe edit contract; providers propose data, never executable code.
 * Canonical forms (all operate on the selected scenario unless explicit):
 * set_parameter: target=parameterId, value=number
 * set_uncertainty: target=parameterId, value=distribution
 * add_scenario: target='scenarios', value=full scenario (unique id)
 * duplicate_scenario: target=sourceScenarioId, value={id,name}
 * apply_stress_preset: target='stressPresets', value=presetId or
 *   {presetId,startMonth} for scheduled stress on a supporting model
 * add_building: target='world.projects', value=full BuildingProposal
 * update_building: target=projectId, value=partial BuildingProposal
 * remove_building: target=projectId
 * move_building: target=projectId, value={districtId,x,z,rotation}
 * change_world_visual: target=visualKey, value=typed value
 * change_success_criterion: target='successCriterion',
 *   value={metricId,operator:'gte'|'lte',value:number}
 * baseRevision is metadata.worldRevision.id, or 'root' before the first edit.
 * Only applyApprovedWorldEdit({approval:true,...}) mutates a cloned draft.
 * Model code, equations, metrics, arbitrary paths and evidence edits unsupported.
 */
export const WORLD_EDIT_SCHEMA_VERSION = "world-edit.v1";
export const WORLD_EDIT_OPERATIONS = Object.freeze(["set_parameter", "set_uncertainty", "add_scenario", "duplicate_scenario", "apply_stress_preset", "add_building", "update_building", "remove_building", "move_building", "change_world_visual", "change_success_criterion"]);
export const VISUAL_RULES = Object.freeze({
  skyColor: { type: "color" }, facadeColor: { type: "color" },
  nightBrightness: { type: "number", min: 0, max: 2 },
  treeDensity: { type: "number", min: 0, max: 2 },
  heightScale: { type: "number", min: 0.25, max: 3 },
  showCranes: { type: "boolean" },
});
export const WORLD_EDIT_LIMITS = Object.freeze({ maxOperations: 32, maxProjects: 24, maxHistory: 100, maxBytes: 128 * 1024 });
export const getWorldRevisionId = (input) => input?.metadata?.worldRevision?.id || (typeof input?.metadata?.worldRevision === "string" ? input.metadata.worldRevision : "root");
/** Synchronous change detector for previews, including ordinary slider edits.
 * Not an authorization token or cryptographic proof; revisions separately use
 * SHA-256 proposal hashes. Providers/UI must retain the validated proposal's
 * baseInputFingerprint through approval, instead of rebuilding it on click.
 */
export function fingerprintWorldInput(input) {
  const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object"
    ? `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}` : JSON.stringify(value);
  const text = stable(Object.fromEntries(["schemaVersion", "name", "decision", "modelId", "modelVersion", "seed", "runs", "years", "scenarios"].map((key) => [key, input?.[key]])));
  let hash = 2166136261;
  let second = 2246822519;
  for (let i = 0; i < text.length; i++) { hash = Math.imul(hash ^ text.charCodeAt(i), 16777619); second = Math.imul(second ^ text.charCodeAt(i), 3266489917); }
  return `${(hash >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}
export const worldEditSchema = Object.freeze({ schemaVersion: WORLD_EDIT_SCHEMA_VERSION, operations: WORLD_EDIT_OPERATIONS, visuals: VISUAL_RULES, limits: WORLD_EDIT_LIMITS, modelEditing: false });
export const WORLD_EDIT_SCHEMA = worldEditSchema;
export function validateWorldVisuals(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, values: {}, errors: ["worldVisuals must be an object"] };
  const values = {};
  for (const [key, entry] of Object.entries(value)) {
    const rule = VISUAL_RULES[key];
    if (!rule) { errors.push(`Unsupported world visual: ${key}`); continue; }
    const valid = rule.type === "color" ? typeof entry === "string" && /^#[0-9a-fA-F]{6}$/.test(entry)
      : rule.type === "boolean" ? typeof entry === "boolean"
      : typeof entry === "number" && Number.isFinite(entry) && entry >= rule.min && entry <= rule.max;
    if (!valid) errors.push(`Invalid world visual value: ${key}`); else values[key] = entry;
  }
  return { valid: !errors.length, values, errors };
}
