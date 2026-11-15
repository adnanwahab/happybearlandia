import {validateWorldEdit} from '../ai/edit-validator.js';
import {getWorldRevisionId} from '../ai/edit-schema.js';
import {createBuildingProposal} from '../buildings/proposal.js';
import {housingModel} from '../models/housing/index.js';

/** Read-only discovery, never an approval. No geometric search or model execution.
 * A parcel hint describes this default footprint only, not legal buildability.
 * Context/source buildings are never mapped to scenario projects by ID alone.
 */
export function worldEditAffordances({input, scenarioId, selection, readOnly = false} = {}) {
  if (readOnly || !Array.isArray(input?.scenarios)) return [];
  const scenario = input.scenarios.find(row => row.id === scenarioId);
  if (!scenario) return [];
  const placement = selection?.placementContext || input.metadata?.placementContext || {};
  const rows = [];
  const add = (kind, label, operation, value) => {
    try {
      const checked = validateWorldEdit({schemaVersion:'world-edit.v1', summary:label,
        baseRevision:getWorldRevisionId(input), operations:[operation]}, {input, scenarioId, placement});
      if (checked.valid) rows.push({kind, label, value});
    } catch { /* Missing/incompatible inputs offer no action. */ }
  };
  if (selection?.kind === 'building' && !selection.existing) {
    const project = scenario.projects?.find(row => row.id === selection.id);
    if (project) add('project', `Edit project · ${project.name}`, {op:'update_building', target:project.id, value:{name:project.name}}, project);
  }
  if (selection?.kind === 'district' && selection.location) {
    const draft = createBuildingProposal({id:'affordance_preview', location:selection.location});
    // The probe ID is detached; opening the ordinary editor creates its own ID.
    if (!scenario.projects?.some(row => row.id === draft.id)) add('parcel', 'Draft a building here · default footprint fits', {op:'add_building', target:'world.projects', value:draft});
  }
  const parameter = housingModel.parameters.find(row => row.id === (selection?.kind === 'parameter' ? selection.id : 'permitting_months'));
  if (parameter) add('policy', `Review policy · ${parameter.label}`, {op:'set_parameter', target:parameter.id, value:scenario.parameters?.[parameter.id]}, parameter.id);
  return rows;
}

export function mountEditAffordances(container, onActivate) {
  const doc = container.ownerDocument, root = doc.createElement('aside');
  root.className = 'wt-affordances'; root.setAttribute('aria-label', 'Editable world hints');
  const sheet = container.closest('details.bw-world-tools');
  if (sheet) root.classList.add('wt-affordances-overlay');
  (sheet?.parentElement || container).append(root);
  return {
    update(context) {
      root.hidden = Boolean(context.readOnly);
      root.replaceChildren();
      if (root.hidden) return;
      const title = doc.createElement('strong'); title.textContent = 'What can I change?'; root.append(title);
      const rows = worldEditAffordances(context);
      for (const row of rows) {
        const button = doc.createElement('button'); button.type = 'button';
        button.textContent = row.label; button.onclick = () => onActivate(row); root.append(button);
      }
      const note = doc.createElement('p');
      note.textContent = rows.length ? 'Synthetic housing assumptions · preview first; approval is separate. Map buildings are context.' : 'No supported edits available for this selection.';
      root.append(note);
    },
    destroy() { root.remove(); },
  };
}
