import { housingModel, stressPresets } from "../models/housing/index.js";
import { validateBuildingProposal, validateBuildingPlacement } from "../buildings/proposal.js";
import { normalizeDecisionInput, clone, validId } from "../decision/contracts.js";
import { WORLD_EDIT_SCHEMA_VERSION, WORLD_EDIT_OPERATIONS, WORLD_EDIT_LIMITS, validateWorldVisuals, getWorldRevisionId, fingerprintWorldInput } from "./edit-schema.js";

const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const prohibited = new Set(["__proto__", "prototype", "constructor", "path", "from", "code", "equation", "evidence"]);
function rejectDangerousKeys(value, errors, depth = 0) {
  if (!value || typeof value !== "object") return;
  if (depth > 24) { errors.push("Edit nesting exceeds the supported depth"); return; }
  for (const [key, child] of Object.entries(value)) {
    if (prohibited.has(key)) errors.push(`Disallowed edit field: ${key}`);
    rejectDangerousKeys(child, errors, depth + 1);
  }
}
function targetId(target, prefixes = []) {
  if (typeof target !== "string") return "";
  for (const prefix of prefixes) if (target.startsWith(prefix)) return target.slice(prefix.length);
  return target;
}
function mergeBuilding(current, patch) {
  const next = { ...current, ...patch };
  for (const key of ["location", "program", "geometry", "finance", "construction"]) if (patch[key]) next[key] = { ...current[key], ...patch[key] };
  return next;
}

/** Pure preview/validation: never alters input, proposal, revisions, or runs.
 * Returns {valid,errors,warnings,proposal,previewInput,requiresSimulationRerun}.
 * previewInput is a detached candidate, not approval. Consumers must use the
 * explicit approval function in revisions.js to commit an immutable draft.
 */
export function validateWorldEdit(proposal, { input, scenarioId, selection, model = housingModel, placement = {} } = {}) {
  const errors = [];
  const warnings = [];
  if (!object(proposal)) return { valid: false, errors: ["A world-edit proposal object is required"], warnings };
  let serialized;
  try { serialized = JSON.stringify(proposal); } catch { return { valid: false, errors: ["Proposal must be JSON serializable"], warnings }; }
  if (serialized.length > WORLD_EDIT_LIMITS.maxBytes) return { valid: false, errors: ["World edit proposal is too large"], warnings };
  rejectDangerousKeys(proposal, errors);
  if (proposal.schemaVersion !== WORLD_EDIT_SCHEMA_VERSION) errors.push("Unsupported world edit schemaVersion");
  if (typeof proposal.summary !== "string" || !proposal.summary.trim() || proposal.summary.length > 2000) errors.push("Proposal summary must contain 1–2000 characters");
  if (!Array.isArray(proposal.operations) || !proposal.operations.length || proposal.operations.length > WORLD_EDIT_LIMITS.maxOperations) errors.push("Provide 1–32 edit operations");
  const revisionId = getWorldRevisionId(input);
  const fingerprint = fingerprintWorldInput(input);
  if (proposal.baseInputFingerprint !== undefined && proposal.baseInputFingerprint !== fingerprint) errors.push("Stale proposal: inputs changed since preview; preview this edit again");
  if ((proposal.baseRevision ?? "root") !== revisionId) errors.push("Stale proposal: the world revision changed; preview this edit again");
  if (proposal.warnings !== undefined && (!Array.isArray(proposal.warnings) || proposal.warnings.some((warning) => typeof warning !== "string" || warning.length > 2000))) errors.push("Warnings must be bounded text entries");
  for (const key of ["prompt", "provider", "model"]) if (proposal[key] !== undefined && (typeof proposal[key] !== "string" || proposal[key].length > (key === "prompt" ? 12000 : 200))) errors.push(`Invalid proposal ${key}`);
  if (errors.length) return { valid: false, errors, warnings };
  let candidate;
  try { candidate = clone(input); } catch { return { valid: false, errors: ["A JSON experiment input is required"], warnings }; }
  if (!Array.isArray(candidate?.scenarios)) return { valid: false, errors: ["A decision experiment with scenarios is required"], warnings };
  const selectedId = scenarioId || candidate.scenarios[0]?.id;
  const current = () => candidate.scenarios.find((scenario) => scenario.id === selectedId);
  if (!current()) return { valid: false, errors: ["Selected scenario does not exist"], warnings };
  let rerun = false;
  for (const operation of proposal.operations) {
    if (!object(operation) || !WORLD_EDIT_OPERATIONS.includes(operation.op)) { errors.push("Unsupported operation; model/code/equation editing is not available"); continue; }
    if (Object.keys(operation).some((key) => !["op", "target", "value"].includes(key))) { errors.push(`Unexpected operation fields for ${operation.op}`); continue; }
    const { op, target, value } = operation;
    if (op !== "remove_building" && value === undefined) { errors.push(`Missing value for ${op}`); continue; }
    const scenario = current();
    if (typeof target !== "string" || target.length > 150 || /(?:__proto__|constructor|prototype|\[|\]|\/|\\)/.test(target)) { errors.push(`Invalid target for ${op}`); continue; }
    if (op !== "change_world_visual") rerun = true;
    if (op === "set_parameter" || op === "set_uncertainty") {
      const id = targetId(target, ["scenario.parameters.", "parameters.", "scenario.uncertainty.", "uncertainty."]);
      if (!model.parameters.some((parameter) => parameter.id === id)) { errors.push(`Unknown parameter: ${id}`); continue; }
      const key = op === "set_parameter" ? "parameters" : "uncertainty";
      scenario[key] = { ...scenario[key], [id]: clone(value) };
      if (op === "set_parameter") {
        if (scenario.uncertainty?.[id]?.type && scenario.uncertainty[id].type !== "fixed") warnings.push(`${id} is now fixed at the approved value; its previous uncertainty distribution is replaced.`);
        scenario.uncertainty = { ...scenario.uncertainty, [id]: { type: "fixed", value } };
      }
    } else if (op === "add_scenario") {
      if (!["scenarios", "world.scenarios"].includes(target) || !object(value)) { errors.push("add_scenario requires a full scenario value and target scenarios"); continue; }
      candidate.scenarios.push(clone(value));
    } else if (op === "duplicate_scenario") {
      const source = candidate.scenarios.find((row) => row.id === target);
      if (!source || !object(value) || !validId(value.id) || typeof value.name !== "string" || Object.keys(value).some((key) => !["id", "name"].includes(key))) { errors.push("duplicate_scenario requires source scenario ID and {id,name}"); continue; }
      candidate.scenarios.push({ ...clone(source), id: value.id, name: value.name, kind: "alternative" });
    } else if (op === "apply_stress_preset") {
      if (!["stressPresets", "world.stressPresets", selectedId].includes(target)) { errors.push("Invalid stress preset target"); continue; }
      const id = typeof value === "string" ? value : value?.presetId;
      if (!stressPresets.some((preset) => preset.id === id)) { errors.push(`Unknown stress preset: ${id}`); continue; }
      if (object(value) && value.startMonth !== undefined) {
        if (!model.supportsScheduledStress) { errors.push("This model version does not support timed stress; it cannot be silently applied at month zero"); continue; }
        if (Object.keys(value).some((key) => !["presetId", "startMonth"].includes(key))) { errors.push("Invalid timed stress fields"); continue; }
        scenario.scheduledStress = [...(scenario.scheduledStress || []), { presetId: id, startMonth: value.startMonth }];
      } else scenario.stressPresets = [...new Set([...(scenario.stressPresets || []), id])];
    } else if (["add_building", "update_building", "remove_building", "move_building"].includes(op)) {
      scenario.projects ||= [];
      const id = targetId(target, ["world.projects.", "projects."]);
      const index = scenario.projects.findIndex((project) => project.id === id);
      if (op === "remove_building") {
        if (index < 0) errors.push(`Building ${id} does not exist`); else scenario.projects.splice(index, 1);
        continue;
      }
      let project;
      if (op === "add_building") {
        if (!["world.projects", "projects"].includes(target) || !object(value)) { errors.push("add_building requires target world.projects and a full building proposal"); continue; }
        project = { ...clone(value), status: "approved" };
        if (scenario.projects.some((existing) => existing.id === project.id)) { errors.push(`Duplicate building ID: ${project.id}`); continue; }
      } else {
        if (index < 0 || !object(value)) { errors.push(`Building ${id} does not exist or edit is invalid`); continue; }
        if (op === "update_building" && (value.id !== undefined && value.id !== id)) { errors.push("Building IDs cannot be changed"); continue; }
        project = op === "move_building" ? mergeBuilding(scenario.projects[index], { location: value }) : mergeBuilding(scenario.projects[index], value);
      }
      const checked = validateBuildingProposal(project);
      if (!checked.valid) { errors.push(...checked.errors.map((error) => `Building: ${error}`)); continue; }
      const placed = validateBuildingPlacement(checked.values, { ...placement, buildings: [...(placement.buildings || []), ...scenario.projects.filter((existing) => existing.id !== checked.values.id)] });
      if (!placed.valid) { errors.push(...placed.errors); continue; }
      warnings.push(...(placed.warnings || []));
      if (op === "add_building") scenario.projects.push(checked.values); else scenario.projects[index] = checked.values;
    } else if (op === "change_world_visual") {
      const key = targetId(target, ["world.worldVisuals.", "worldVisuals.", "world.visuals."]);
      const checked = validateWorldVisuals({ [key]: value });
      if (!checked.valid) errors.push(...checked.errors); else scenario.worldVisuals = { ...scenario.worldVisuals, ...checked.values };
    } else if (op === "change_success_criterion") {
      if (!["successCriterion", "world.successCriterion"].includes(target)) errors.push("Invalid success criterion target");
      else scenario.successCriterion = clone(value);
    }
  }
  if (!errors.length) {
    // Canonical inherited parameters are resolved display values. Approved
    // changes must also update explicit overrides, or normalization would undo
    // the edit and silently restore the parent's/old override's value.
    for (const scenario of candidate.scenarios) if (scenario.inheritsFrom) {
      const before = input.scenarios.find((entry) => entry.id === scenario.id);
      if (!before) continue;
      for (const key of ["parameters", "uncertainty"]) {
        const changed = Object.fromEntries(Object.entries(scenario[key] || {}).filter(([id, value]) => JSON.stringify(value) !== JSON.stringify(before[key]?.[id])));
        if (Object.keys(changed).length) scenario.overrides = { ...scenario.overrides, [key]: { ...scenario.overrides?.[key], ...clone(changed) } };
      }
      for (const key of ["projects", "stressPresets", "scheduledStress", "worldVisuals", "successCriterion", "outcomeCriteria", "timelineFork"]) if (scenario[key] !== undefined && JSON.stringify(scenario[key]) !== JSON.stringify(before[key])) scenario.overrides = { ...scenario.overrides, [key]: clone(scenario[key]) };
    }
    try { candidate = normalizeDecisionInput(candidate, model); } catch (error) { errors.push(...(error.errors || [error.message])); }
  }
  const normalizedProposal = { ...clone(proposal), requiresSimulationRerun: rerun, warnings: [...new Set([...(proposal.warnings || []), ...warnings])], baseRevision: revisionId, baseInputFingerprint: fingerprint };
  return { valid: !errors.length, errors, warnings: normalizedProposal.warnings, proposal: normalizedProposal, previewInput: errors.length ? null : candidate, requiresSimulationRerun: rerun, selection: selection ? clone(selection) : null };
}
