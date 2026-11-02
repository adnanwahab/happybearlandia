/** Intervention.v1 is a transport wrapper around the existing allowlisted edit
 * vocabulary. It never applies on construction or preview. approval:true must
 * still come from the existing explicit user approval button.
 */
import { validateWorldEdit } from "../ai/edit-validator.js";
import { applyApprovedWorldEdit } from "../ai/revisions.js";
import { getWorldRevisionId, fingerprintWorldInput } from "../ai/edit-schema.js";
import { clone } from "./contracts.js";
export function createIntervention({ input, scenarioId, operations, summary = "Proposed intervention", source = "user" }) {
  return { schemaVersion: "intervention.v1", id: `intervention_${crypto.randomUUID()}`, scenarioId, source, proposal: { schemaVersion: "world-edit.v1", summary, operations: clone(operations), warnings: [], requiresSimulationRerun: true, baseRevision: getWorldRevisionId(input), baseInputFingerprint: fingerprintWorldInput(input), provider: source, model: "hbl-intervention.v1" } };
}
export function validateIntervention(intervention, context = {}) {
  if (intervention?.schemaVersion !== "intervention.v1") return { valid: false, errors: ["Unsupported intervention schema"], warnings: [] };
  return validateWorldEdit(intervention.proposal, { ...context, scenarioId: intervention.scenarioId || context.scenarioId });
}
export async function applyApprovedIntervention({ intervention, input, approval, ...context }) {
  const checked = validateIntervention(intervention, { input, ...context });
  if (!checked.valid) throw new Error(checked.errors.join("; "));
  return applyApprovedWorldEdit({ input, proposal: checked.proposal, scenarioId: intervention.scenarioId, approval, ...context });
}
