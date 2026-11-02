import { validateWorldEdit } from "./edit-validator.js";
import { getWorldRevisionId, WORLD_EDIT_LIMITS } from "./edit-schema.js";
import { clone, normalizeDecisionInput } from "../decision/contracts.js";
import { housingModel, resolveHousingModel } from "../models/housing/index.js";

/** Public browser-safe exports:
 * applyApprovedWorldEdit({input,proposal,scenarioId,approval,selection,model?,placement?})
 * undoWorldEdit({input,approval,model?})
 * restoreWorldRevision({input,revisionId,approval,model?})
 * All return Promise<{input,revision,audit}>; approval must be boolean true from
 * a user click. False/missing approval returns an unchanged detached input and
 * revision:null. Never call these merely to preview. Undo/restore APPEND a new
 * immutable revision; they never rewrite/delete earlier history. Snapshots omit
 * recursive revision metadata. Completed experiment IDs/results are not edited.
 */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function hashWorldEditProposal(proposal) {
  const bytes = new TextEncoder().encode(canonical(proposal));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
function snapshot(input) {
  const result = clone(input);
  result.metadata ||= {};
  delete result.metadata.worldRevision;
  delete result.metadata.worldEditHistory;
  for (const key of ["id", "status", "progress", "createdAt", "startedAt", "completedAt", "error", "resultsUrl", "manifestUrl", "shareUrl", "eventsUrl"]) delete result[key];
  return result;
}
function rejected(input) { return { input: clone(input), revision: null, audit: { applied: false, status: "not-approved" } }; }
async function append({ input, nextInput, proposal, kind = "edit", restoredFrom, rerun }) {
  const history = clone(input.metadata?.worldEditHistory || []);
  if (!Array.isArray(history)) throw new Error("World revision history must be an array");
  if (history.length >= WORLD_EDIT_LIMITS.maxHistory) throw new Error("World revision history limit reached (100); duplicate the project to begin a new history");
  const approvedAt = new Date().toISOString();
  const revision = {
    id: `revision_${crypto.randomUUID()}`, parent: getWorldRevisionId(input), kind,
    prompt: proposal.prompt || "", provider: proposal.provider || "user", model: proposal.model || null,
    summary: proposal.summary, operations: clone(proposal.operations || []),
    proposalHash: await hashWorldEditProposal(proposal), approvedAt,
    requiresSimulationRerun: Boolean(rerun), ...(restoredFrom ? { restoredFrom } : {}),
  };
  const next = snapshot(nextInput);
  history.push({ ...revision, before: snapshot(input), after: snapshot(next) });
  next.metadata = { ...next.metadata, worldRevision: clone(revision), worldEditHistory: history };
  if (rerun) next.metadata.resultsStale = true;
  else if (input.metadata?.resultsStale) next.metadata.resultsStale = true;
  freeze(next.metadata.worldRevision);
  freeze(next.metadata.worldEditHistory);
  return { input: next, revision: freeze(clone(revision)), audit: freeze({ ...clone(revision), applied: true, status: "approved" }) };
}
export async function applyApprovedWorldEdit({ input, proposal, scenarioId, approval, selection, model, placement } = {}) {
  if (approval !== true) return rejected(input);
  const checked = validateWorldEdit(proposal, { input, scenarioId, selection, model, placement });
  if (!checked.valid) throw new Error(checked.errors.join("; "));
  return append({ input, nextInput: checked.previewInput, proposal: checked.proposal, rerun: checked.requiresSimulationRerun });
}
export async function restoreWorldRevision({ input, revisionId, approval, model } = {}) {
  if (approval !== true) return rejected(input);
  const history = input.metadata?.worldEditHistory || [];
  if (!Array.isArray(history)) throw new Error("World revision history must be an array");
  const target = revisionId === "root" ? history[0]?.before : history.find((entry) => entry.id === revisionId)?.after;
  if (!target) throw new Error("Requested revision snapshot does not exist");
  const targetModel = model || (target.modelVersion ? resolveHousingModel(target.modelVersion).model : housingModel);
  const normalizedTarget = normalizeDecisionInput(target, targetModel);
  const beforeMath = snapshot(input);
  const afterMath = snapshot(normalizedTarget);
  // Visual config and metadata do not alter math. Undo of a purely visual edit
  // preserves its non-rerun classification, including seeds and existing rows.
  const mathOnly = (value) => ({ ...value, metadata: undefined, scenarios: value.scenarios.map(({ worldVisuals, ...scenario }) => scenario) });
  const rerun = canonical(mathOnly(beforeMath)) !== canonical(mathOnly(afterMath));
  return append({ input, nextInput: normalizedTarget, kind: "restore", restoredFrom: revisionId, rerun, proposal: { schemaVersion: "world-edit.v1", summary: `Restore revision ${revisionId}`, operations: [], baseRevision: getWorldRevisionId(input), provider: "user", prompt: "Restore approved by user" } });
}
export async function undoWorldEdit({ input, approval } = {}) {
  if (approval !== true) return rejected(input);
  const current = input.metadata?.worldRevision;
  if (!current?.parent) throw new Error("There is no approved edit to undo");
  return restoreWorldRevision({ input, revisionId: current.parent, approval });
}
export const undoApprovedWorldEdit = undoWorldEdit;
export const restoreWorldEditRevision = restoreWorldRevision;
