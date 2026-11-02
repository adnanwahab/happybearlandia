/** Reusable Build Something / Edit World surface, also mounted by /world bridge.
 * Preview, placement, selection, rejection and proposal editing are pure drafts.
 * Only the named Approve button calls applyApprovedWorldEdit with approval:true.
 * Host callbacks receive a NEW input; completed experiment objects are never mutated.
 * Optional placement context: selection.placementContext or input.metadata.placementContext.
 */
import { createBuildingProposal, validateBuildingProposal, validateBuildingPlacement } from '../buildings/proposal.js';
import { validateWorldEdit } from '../ai/edit-validator.js';
import { getWorldRevisionId } from '../ai/edit-schema.js';
import * as revisions from '../ai/revisions.js';
import { housingModel } from '../models/housing/index.js';

const clone = value => structuredClone(value);
const text = value => typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '—');
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: Math.abs(value) >= 1e6 ? 'compact' : 'standard' }).format(value);
const fields = [
  ['name', 'Project name', 'text'], ['location.districtId', 'District / parcel ID', 'text'],
  ['geometry.floors', 'Floors', 'number'], ['geometry.heightMeters', 'Height · meters', 'number'],
  ['geometry.footprintSqFt', 'Footprint · sq ft', 'number'], ['program.residentialUnits', 'Residential units', 'number'],
  ['program.affordableUnits', 'Affordable units', 'number'], ['program.retailSqFt', 'Retail · sq ft', 'number'],
  ['program.officeSqFt', 'Office · sq ft', 'number'], ['program.parkingSpaces', 'Parking spaces', 'number'],
  ['finance.estimatedCost', 'Estimated cost · USD', 'number'], ['finance.publicSubsidy', 'Public subsidy · USD', 'number'],
  ['construction.permitMonths', 'Permit duration · months', 'number'], ['construction.buildMonths', 'Construction · months', 'number'],
  ['location.x', 'East / west · meters', 'number'], ['location.z', 'North / south · meters', 'number'],
  ['location.rotation', 'Rotation · radians', 'number'],
];
const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function setAt(object, path, value) { const parts = path.split('.'); const last = parts.pop(); let at = object; for (const key of parts) at = at[key] ||= {}; at[last] = value; }
const fingerprint = input => JSON.stringify({ scenarios: input.scenarios, seed: input.seed, years: input.years, modelVersion: input.modelVersion, revision: input.metadata?.worldRevision });
function historyOf(input) { return Array.isArray(input.metadata?.worldEditHistory) ? input.metadata.worldEditHistory : []; }

/** Find a suggested parcel for a draft; never approves or moves existing input.
 * This is a bounded geometric search, not a claim of zoning/buildability rights.
 */
export function findSuggestedBuildingLocation(context = {}, proposal = createBuildingProposal()) {
  const bounds = context.bounds || { minX: -600, maxX: 600, minZ: -600, maxZ: 600 };
  const minX = bounds.minX ?? bounds.min?.x, maxX = bounds.maxX ?? bounds.max?.x;
  const minZ = bounds.minZ ?? bounds.min?.z, maxZ = bounds.maxZ ?? bounds.max?.z;
  const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
  const candidateDistricts = context.districts?.length ? context.districts.map(d => d.id) : [proposal.location.districtId];
  const candidates = [[centerX, centerZ], [centerX + 150, centerZ + 100], [centerX - 150, centerZ + 100]];
  for (let row = 1; row < 12; row++) for (let col = 1; col < 12; col++) candidates.push([minX + (maxX - minX) * col / 12, minZ + (maxZ - minZ) * row / 12]);
  for (const districtId of candidateDistricts) for (const [x, z] of candidates) {
    const location = { ...proposal.location, districtId, x: Math.round(x), z: Math.round(z) };
    const result = validateBuildingPlacement({ ...clone(proposal), location }, context);
    if (result.valid) return location;
  }
  return null;
}

export function mountWorldTools(container, {
  getInput, getScenarioId, onInputChange, onPreview = () => {}, onPlaceRequest = () => {}, onCancelPreview = () => {}, readOnly = false,
} = {}) {
  if (!container?.ownerDocument || typeof getInput !== 'function') throw new TypeError('World tools require a container and getInput().');
  const doc = container.ownerDocument;
  const node = (tag, content, className) => { const element = doc.createElement(tag); if (content !== undefined) element.textContent = content; if (className) element.className = className; return element; };
  const root = node('section', undefined, 'world-tools'); root.setAttribute('aria-label', 'Build Something and Edit World');
  root.innerHTML = `<header class="wt-heading"><div><p class="wt-eyebrow">CHANGE SOMETHING CONCRETE</p><h2>Shape the world. Test the consequences.</h2><p>Systemic policy and specific building projects coexist. Preview first; approval creates a new revision.</p></div><div class="wt-entry-actions"><button type="button" data-action="new-building">+ Propose building</button><button type="button" data-action="edit-world">✦ Edit world</button></div></header>
    <div class="wt-selection" data-selection>No object selected · choose a building, district, or parameter.</div>
    <div class="wt-status" role="status" aria-live="polite" data-status>Propose a building, or describe a world edit. Nothing changes until you approve.</div>
    <nav class="wt-tabs" aria-label="World tools"><button type="button" data-tab="build" aria-pressed="true">Building projects</button><button type="button" data-tab="edit" aria-pressed="false">Edit world</button><button type="button" data-tab="history" aria-pressed="false">World history</button></nav>
    <section data-pane="build"><div class="wt-project-list" data-projects></div><form class="wt-building-form" data-building-form hidden><div class="wt-subheading"><h3 data-form-title>New building proposal</h3><span class="wt-chip">Unapproved preview</span></div><p>Mixed-use residential · locations use world meters; footprints use square feet. Placement checks do not establish zoning or legal approval.</p><div class="wt-form-grid" data-building-fields></div><div class="wt-form-actions"><button type="button" data-action="place-building">Place in 3D world</button><button type="submit">Review project changes</button><button type="button" data-action="cancel-building">Cancel proposal</button></div><p class="wt-hint">In placement mode: move pointer, click to place · R rotate · + / − resize · Esc cancel. Typing fields keep normal keyboard behavior.</p></form></section>
    <section data-pane="edit" hidden><label>What would you like to change?<textarea data-prompt rows="3" maxlength="4000" placeholder="Add a 24-story, 310-unit apartment tower here. Or make construction capacity 20% higher."></textarea></label><div class="wt-provider-row"><label>Provider<select data-provider><option value="demo">Local demo parser · not AI</option></select></label><button type="button" data-action="request-edit">Preview edit</button></div><p class="wt-hint" data-provider-note>The local demo parser is deterministic. Configured AI providers propose bounded edits; they cannot approve them.</p><details><summary>Supported edits and boundaries</summary><p>Parameters, uncertainty, alternatives, immediate stress presets, building projects, world appearance, and success criteria. Timed shocks are accepted only when modeled.</p><button type="button" disabled>Model equations / new metrics · unavailable in this release</button><p>No repository code, evidence provenance, journal entries, or resident records are edited by this tool.</p></details></section>
    <section class="wt-preview" data-preview hidden><div class="wt-preview-title"><h3>Proposed world edit</h3><span data-classification class="wt-chip"></span></div><p data-summary></p><div data-diff></div><ul data-warnings></ul><p class="wt-hint" data-validation></p><label class="wt-rerun"><input type="checkbox" data-rerun checked> Simulate the approved revision using 10 futures per scenario</label><div class="wt-form-actions"><button type="button" data-action="approve" class="wt-approve">Approve & simulate</button><button type="button" data-action="edit-proposal">Edit proposal</button><button type="button" data-action="reject">Reject</button></div><p class="wt-hint">Approval records the proposal hash, provider, prompt, operations, and parent revision. Previous completed experiments remain unchanged.</p></section>
    <section data-pane="history" hidden><div class="wt-form-actions"><button type="button" data-action="undo">Undo last approved edit</button></div><div data-history></div><div data-compare></div></section>`;
  container.append(root);
  const find = selector => root.querySelector(selector);
  let destroyed = false, locked = Boolean(readOnly), selected = null, draft = null, pending = null, pendingBase = '', editingProjectId = null, tab = 'build', request = 0;
  let editingProposal = null;
  let busy = false, providersLoaded = false, edited = false;
  const currentScenario = () => getInput()?.scenarios?.find(s => s.id === getScenarioId?.()) || getInput()?.scenarios?.find(s => s.kind === 'plan-a') || getInput()?.scenarios?.[0];
  function announce(message, error = false) { find('[data-status]').textContent = message; find('[data-status]').classList.toggle('wt-error', error); }
  function selectTab(name) { tab = name; for (const pane of root.querySelectorAll('[data-pane]')) pane.hidden = pane.dataset.pane !== name; for (const button of root.querySelectorAll('[data-tab]')) button.setAttribute('aria-pressed', String(button.dataset.tab === name)); }
  function constraints() {
    const input = getInput(), scenario = currentScenario();
    const context = selected?.placementContext || input.metadata?.placementContext || {};
    return { ...context, buildings: [...(context.buildings || []), ...(scenario?.projects || []).filter(p => p.id !== draft?.id && p.status !== 'cancelled')] };
  }
  function cancelPreview({ clearDraft = true } = {}) {
    request++; pending = null; pendingBase = ''; find('[data-preview]').hidden = true; onPreview(null); onCancelPreview();
    if (clearDraft) { draft = null; editingProjectId = null; editingProposal = null; find('[data-building-form]').hidden = true; }
  }
  function draftFromForm() {
    if (!draft) throw new Error('Create a building proposal first.');
    const next = clone(draft);
    for (const [path, , type] of fields) {
      const input = find(`[data-field="${path}"]`);
      if (type === 'number' && (!input.value.trim() || !Number.isFinite(Number(input.value)))) throw new Error(`Enter a finite value for ${path}.`);
      setAt(next, path, type === 'number' ? Number(input.value) : input.value.trim());
    }
    return next;
  }
  function renderBuildingForm() {
    const box = find('[data-building-fields]'); box.replaceChildren();
    for (const [path, label, type] of fields) {
      const wrapper = node('label', label); const input = node('input'); input.type = type; input.dataset.field = path; input.value = String(valueAt(draft, path) ?? '');
      input.setAttribute('aria-label', label); if (type === 'number') input.step = 'any'; input.disabled = locked;
      input.addEventListener('input', () => {
        edited = true;
        try { draft = draftFromForm(); onPreview(clone(draft)); }
        catch (error) { announce(error.message, true); }
        if (pending) { pending = null; find('[data-preview]').hidden = true; announce('Project draft changed. Review the new changes before approving.'); }
      }); wrapper.append(input); box.append(wrapper);
    }
    find('[data-building-form]').hidden = false; find('[data-form-title]').textContent = editingProjectId ? 'Edit building project' : 'New building proposal';
  }
  function newBuilding(value = null) {
    if (locked) return;
    cancelPreview(); draft = value ? clone(value) : createBuildingProposal(); draft.status = 'proposed';
    if (!value && selected?.location) draft.location = { ...draft.location, ...selected.location };
    else if (!value) { const suggested = findSuggestedBuildingLocation(constraints(), draft); if (suggested) draft.location = suggested; }
    editingProjectId = value?.id && currentScenario()?.projects?.some(p => p.id === value.id) ? value.id : null;
    edited = false; selectTab('build'); renderBuildingForm(); onPreview(clone(draft)); announce('Unapproved building preview. Configure it and place it in the world, then review the project.');
  }
  function localProposal(operations, summary, extra = {}) {
    return { schemaVersion: 'world-edit.v1', summary, operations, requiresSimulationRerun: !operations.every(operation => operation.op === 'change_world_visual'), warnings: [], provider: 'user', model: 'manual-world-tools.v1', prompt: summary, baseRevision: getWorldRevisionId(getInput()), ...extra };
  }
  function reviewBuilding() {
    draft = draftFromForm(); const validated = validateBuildingProposal(draft);
    if (!validated.valid) throw new Error((validated.errors || []).join(' '));
    const placed = validateBuildingPlacement(validated.values || draft, constraints());
    if (!placed.valid) throw new Error((placed.errors || []).join(' '));
    const value = { ...(validated.values || draft), status: 'approved' };
    const operation = editingProjectId ? { op: 'update_building', target: editingProjectId, value } : { op: 'add_building', target: 'world.projects', value };
    if (editingProposal) { const proposal = clone(editingProposal.proposal); proposal.operations[editingProposal.index] = operation; showProposal(proposal); }
    else showProposal(localProposal([operation], `${editingProjectId ? 'Update' : 'Approve'} ${value.name}`, { warnings: placed.warnings || [] }));
  }
  function operationLabel(operation) {
    const target = operation.target;
    const parameterId = typeof target === 'string' ? target.split('.').at(-1) : target?.parameterId;
    const definition = housingModel.parameters.find(p => p.id === parameterId);
    if (operation.op === 'set_parameter') return `${definition?.label || text(target)} → ${text(operation.value)}${definition?.unit ? ` ${definition.unit}` : ''}`;
    if (operation.op === 'set_uncertainty') return `${definition?.label || text(target)} uncertainty → ${text(operation.value)}`;
    if (/building/.test(operation.op)) return `${operation.value?.name || currentScenario()?.projects?.find(p => p.id === target)?.name || text(target)} · ${operation.op.replaceAll('_', ' ')}`;
    return `${operation.op.replaceAll('_', ' ')} · ${text(target)} → ${text(operation.value)}`;
  }
  function validatePending() {
    if (!pending) return { valid: false, errors: ['No proposal.'], warnings: [] };
    return validateWorldEdit(pending, { input: getInput(), scenarioId: currentScenario()?.id, selection: selected, placement: constraints() });
  }
  function showProposal(proposal) {
    pending = clone(proposal); const checked = validatePending(); if (checked.valid) pending = checked.proposal; pendingBase = `${fingerprint(getInput())}:${currentScenario()?.id}`; edited = false; renderProposal();
    onPreview(clone(pending));
    announce('Proposed changes are ready for review. Nothing has been applied.');
  }
  function renderProposal() {
    find('[data-preview]').hidden = !pending; if (!pending) return;
    const checked = validatePending();
    if (pendingBase && pendingBase !== `${fingerprint(getInput())}:${currentScenario()?.id}`) { checked.valid = false; checked.errors = [...(checked.errors || []), 'Inputs or selected scenario changed. Preview this edit again before approval.']; }
    const rerun = checked.requiresSimulationRerun ?? pending.requiresSimulationRerun !== false;
    find('[data-classification]').textContent = rerun ? 'Affects simulation' : 'Visual only · seeds and math unchanged';
    find('[data-summary]').textContent = pending.summary || 'Review proposed changes';
    const box = find('[data-diff]'); box.replaceChildren();
    for (const [index, operation] of pending.operations.entries()) {
      const row = node('article', undefined, 'wt-diff-row'); row.append(node('strong', operationLabel(operation)));
      const previous = operation.op === 'set_parameter' ? currentScenario()?.parameters?.[operation.target.split('.').at(-1)] : operation.op === 'change_world_visual' ? currentScenario()?.worldVisuals?.[operation.target] : undefined;
      if (previous !== undefined) row.append(node('p', `Current: ${text(previous)} → Proposed: ${text(operation.value)}`));
      if (operation.value?.program) row.append(node('p', `${operation.value.geometry?.floors} floors · ${operation.value.program.residentialUnits} homes · ${operation.value.program.affordableUnits} affordable · ${money(operation.value.finance?.estimatedCost || 0)} estimated cost`));
      if (edited) appendOperationEditor(row, operation, index);
      box.append(row);
    }
    const warnings = find('[data-warnings]'); warnings.replaceChildren();
    for (const warning of new Set([...(pending.warnings || []), ...(checked.warnings || []), ...(checked.errors || [])])) warnings.append(node('li', text(warning)));
    find('[data-validation]').textContent = checked.valid ? 'Schema validation passed. Final validation runs again when you approve.' : 'This proposal cannot be approved. Resolve the validation messages or reject it.';
    find('[data-action="approve"]').disabled = locked || busy || !checked.valid;
    find('[data-rerun]').disabled = !rerun || locked; find('[data-rerun]').closest('label').hidden = !rerun;
    find('[data-action="approve"]').textContent = rerun && find('[data-rerun]').checked ? 'Approve & simulate' : 'Approve & apply';
  }
  function appendOperationEditor(row, operation) {
    const wrapper = node('div', undefined, 'wt-inline-editor');
    if (operation.op === 'set_parameter') {
      const input = node('input'); input.type = 'number'; input.step = 'any'; input.value = String(operation.value); input.setAttribute('aria-label', 'Proposed parameter value');
      input.addEventListener('input', () => { operation.value = Number(input.value); refreshApproval(); }); wrapper.append(input);
    } else if (operation.op === 'change_world_visual') {
      const input = node('input'); input.type = typeof operation.value === 'boolean' ? 'checkbox' : typeof operation.value === 'number' ? 'number' : /color/i.test(String(operation.target)) ? 'color' : 'text';
      if (input.type === 'checkbox') input.checked = operation.value; else input.value = String(operation.value);
      input.setAttribute('aria-label', 'Proposed visual value'); input.addEventListener('input', () => { operation.value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value; refreshApproval(); }); wrapper.append(input);
    } else if (['add_building', 'update_building'].includes(operation.op)) {
      const button = node('button', 'Edit building configuration'); button.type = 'button'; button.addEventListener('click', () => { const previous = clone(pending); const index = pending.operations.indexOf(operation); const checked = validatePending(); const candidate = checked.previewInput?.scenarios?.find(s => s.id === currentScenario()?.id)?.projects?.find(p => p.id === (operation.op === 'update_building' ? operation.target : operation.value?.id)); newBuilding(candidate || createBuildingProposal(operation.value)); editingProposal = { proposal: previous, index }; }); wrapper.append(button);
    } else if (operation.op === 'set_uncertainty') {
      for (const [key, value] of Object.entries(operation.value || {})) {
        const label = node('label', key), input = node('input'); input.type = typeof value === 'number' ? 'number' : 'text'; input.step = 'any'; input.value = String(value);
        input.addEventListener('input', () => { operation.value[key] = input.type === 'number' ? Number(input.value) : input.value; refreshApproval(); }); label.append(input); wrapper.append(label);
      }
    } else wrapper.append(node('p', 'Revise the prompt and preview again to change this operation.'));
    row.append(wrapper);
  }
  function refreshApproval() {
    const checked = validatePending(); find('[data-action="approve"]').disabled = locked || busy || !checked.valid;
    if (checked.valid) onPreview(clone(checked.proposal));
    find('[data-validation]').textContent = checked.valid ? 'Edited proposal validates. Review the updated values before approval.' : (checked.errors || []).map(text).join(' ');
  }
  async function approve() {
    if (locked || busy || !pending) return;
    if (pendingBase !== `${fingerprint(getInput())}:${currentScenario()?.id}`) throw new Error('Inputs changed after this preview. Preview the edit again against the current revision.');
    const checked = validatePending(); if (!checked.valid) throw new Error((checked.errors || []).join(' '));
    const proposal = clone(checked.proposal || pending), rerun = checked.requiresSimulationRerun !== false && find('[data-rerun]').checked;
    busy = true; find('[data-action="approve"]').disabled = true;
    try {
      const applied = await revisions.applyApprovedWorldEdit({ input: clone(getInput()), proposal, scenarioId: currentScenario()?.id, approval: true, selection: selected, placement: constraints() });
      let outcome;
      try { outcome = await onInputChange(applied.input, { rerun }); }
      catch (error) {
        if (getWorldRevisionId(getInput()) !== applied.revision?.id) throw error;
        cancelPreview(); update(); announce(`Revision approved, but the follow-up simulation failed: ${error.message}. Retry simulation using the run controls.`, true); return;
      }
      cancelPreview(); update();
      if (outcome?.simulationError) { announce(outcome.simulationError, true); return; }
      announce(rerun ? 'Revision approved. A new experiment is being simulated; previous results remain reproducible.' : proposal.requiresSimulationRerun === false ? 'Visual revision approved. Simulation results and seeds are unchanged.' : 'Revision approved. Results are stale until you simulate the new input.');
    } finally { busy = false; if (pending) renderProposal(); }
  }
  async function proposeEdit() {
    if (locked || busy) return;
    const prompt = find('[data-prompt]').value.trim(); if (!prompt) throw new Error('Describe a desired world change first.');
    const token = ++request; const requestedBase = `${fingerprint(getInput())}:${currentScenario()?.id}`; busy = true; find('[data-action="request-edit"]').disabled = true; announce('Preparing a structured edit proposal…');
    // Deliberately omit evidence, revision snapshots, journals, residents and customer records.
    const input = getInput();
    // Exact experiment fields are needed for the stale-input fingerprint. The
    // server provider adapter independently sends only allowlisted numeric model
    // context to vendors; names/decision text never enter vendor context.
    const clean = { ...clone(input), metadata: { worldRevision: input.metadata?.worldRevision } };
    try {
      const response = await fetch('/api/world-edits/propose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, provider: find('[data-provider]').value, input: clean, scenarioId: currentScenario()?.id, selection: selected ? { kind: selected.kind, id: selected.id, label: selected.label, location: selected.location } : null }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || payload.error || `Could not preview edit (${response.status}).`);
      if (destroyed || token !== request) return;
      if (requestedBase !== `${fingerprint(getInput())}:${currentScenario()?.id}`) throw new Error('Inputs or selection changed while the edit was being proposed. Preview the request again.');
      showProposal(payload.proposal); selectTab('edit');
    } finally { busy = false; find('[data-action="request-edit"]').disabled = locked; if (pending) renderProposal(); }
  }
  async function loadProviders() {
    if (providersLoaded) return; providersLoaded = true;
    try {
      const response = await fetch('/api/world-edits/providers'); if (!response.ok) return;
      const payload = await response.json(); const list = Array.isArray(payload.providers) ? payload.providers : [];
      const select = find('[data-provider]'); const selectedId = select.value; select.replaceChildren();
      for (const provider of list) {
        const id = provider.id || provider.provider; if (!id) continue; const option = node('option', `${provider.label || provider.name || id}${id === 'demo' ? ' · deterministic, not AI' : provider.configured === false || provider.available === false ? ' · not configured' : ''}`);
        option.value = id; option.disabled = provider.configured === false || provider.available === false; select.append(option);
      }
      if (!select.options.length) { const option = node('option', 'Local demo parser · not AI'); option.value = 'demo'; select.append(option); }
      if ([...select.options].some(option => option.value === selectedId && !option.disabled)) select.value = selectedId;
      else if (payload.defaultProvider) select.value = payload.defaultProvider;
    } catch { announce('Provider status unavailable. You can still configure buildings manually.'); }
  }
  function renderProjects() {
    const box = find('[data-projects]'); box.replaceChildren(); const scenario = currentScenario();
    box.append(node('h3', `${scenario?.name || 'Scenario'} · specific projects`));
    const projects = scenario?.projects || [];
    if (!projects.length) box.append(node('p', 'No specific building projects. Policy assumptions continue to affect citywide development. Propose a building to test a concrete intervention.'));
    for (const project of projects) {
      const row = node('article', undefined, 'wt-project-card'); row.append(node('strong', project.name), node('span', project.status, 'wt-chip'));
      row.append(node('p', `${project.program?.residentialUnits || 0} homes · ${project.program?.affordableUnits || 0} affordable · ${project.geometry?.floors || 0} floors · ${money(project.finance?.estimatedCost || 0)}`));
      const actions = node('div', undefined, 'wt-form-actions');
      for (const [label, action] of [['Edit project', () => newBuilding(project)], ['Remove project', () => showProposal(localProposal([{ op: 'remove_building', target: project.id }], `Remove ${project.name}`))], ['Cancel project', () => showProposal(localProposal([{ op: 'update_building', target: project.id, value: { ...clone(project), status: 'cancelled' } }], `Cancel ${project.name}`))]]) {
        const button = node('button', label); button.type = 'button'; button.disabled = locked; button.addEventListener('click', () => perform(action)); actions.append(button);
      }
      row.append(actions); box.append(row);
    }
  }
  function renderHistory() {
    const box = find('[data-history]'); box.replaceChildren(); const input = getInput(); const history = historyOf(input);
    find('[data-action="undo"]').disabled = locked || !history.length;
    if (!history.length) box.append(node('p', 'No approved world edits. Rejected proposals never enter the revision history.'));
    for (const revision of [...history].reverse()) {
      const row = node('article', undefined, 'wt-history-row'); row.append(node('strong', revision.summary || revision.prompt || revision.id || revision.revisionId || 'Approved world revision'));
      row.append(node('p', `${revision.provider || 'user'} · ${revision.model || 'manual'} · ${revision.approvedAt || revision.createdAt || ''}`));
      if (revision.proposalHash) row.append(node('code', revision.proposalHash));
      const actions = node('div', undefined, 'wt-form-actions');
      const compare = node('button', 'Compare'); compare.type = 'button'; compare.addEventListener('click', () => compareRevision(revision));
      const restore = node('button', 'Restore this version'); restore.type = 'button'; restore.disabled = locked; restore.addEventListener('click', () => perform(() => restoreRevision(revision)));
      actions.append(compare, restore); row.append(actions); box.append(row);
    }
  }
  function compareRevision(revision) {
    const box = find('[data-compare]'); box.replaceChildren(node('h3', 'Revision comparison'));
    const current = getInput(), snapshot = revision.after;
    box.append(node('p', `Selected revision ${text(revision.id || revision.revisionId)} → current ${getWorldRevisionId(current)}`));
    let differences = 0;
    if (snapshot?.scenarios) for (const source of snapshot.scenarios) {
      const target = current.scenarios.find(s => s.id === source.id);
      if (!target) { box.append(node('p', `${source.name}: scenario removed`)); differences++; continue; }
      for (const section of ['parameters', 'uncertainty', 'worldVisuals', 'successCriterion']) {
        const previous = source[section] || {}, next = target[section] || {};
        for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
          box.append(node('p', `${target.name} · ${section === 'parameters' ? housingModel.parameters.find(p => p.id === key)?.label || key : `${section} / ${key}`}: ${text(previous[key])} → ${text(next[key])}`)); differences++;
        }
      }
      const priorProjects = new Map((source.projects || []).map(p => [p.id, p]));
      const nextProjects = new Map((target.projects || []).map(p => [p.id, p]));
      for (const id of new Set([...priorProjects.keys(), ...nextProjects.keys()])) {
        const before = priorProjects.get(id), after = nextProjects.get(id);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        const describe = p => p ? `${p.status}, ${p.geometry.floors} floors, ${p.program.residentialUnits} homes at (${p.location.x}, ${p.location.z} m)` : 'absent';
        box.append(node('p', `${target.name} · ${after?.name || before?.name}: ${describe(before)} → ${describe(after)}`)); differences++;
      }
    }
    if (!differences) box.append(node('p', snapshot ? 'The selected revision has the same scenario inputs as the current draft.' : 'This history entry has no comparable snapshot; inspect its recorded operations below.'));
    const details = node('details'); details.append(node('summary', 'Recorded operations and provenance'));
    details.append(node('p', `${revision.provider || 'user'} · ${revision.model || 'manual'} · ${revision.approvedAt || ''}`));
    for (const operation of revision.operations || []) details.append(node('p', operationLabel(typeof operation === 'string' ? { op: operation } : operation)));
    box.append(details);
  }
  async function restoreRevision(revision) {
    if (locked) return;
    const restore = revisions.restoreWorldRevision;
    if (typeof restore !== 'function') throw new Error('Revision restore is unavailable for this stored history format.');
    const result = await restore({ input: clone(getInput()), revisionId: revision.id || revision.revisionId, approval: true });
    await onInputChange(result.input || result, { rerun: false }); cancelPreview(); update(); announce(result.revision?.requiresSimulationRerun === false ? 'Visual version restored through a new revision. Stored simulation results and seeds are unchanged.' : 'Version restored as a new revision. Existing completed results remain unchanged. Simulate to update outcomes.');
  }
  async function undo() {
    if (locked) return; const fn = revisions.undoWorldEdit || revisions.undoApprovedWorldEdit;
    if (typeof fn !== 'function') throw new Error('Undo is unavailable for this stored history format.');
    const result = await fn({ input: clone(getInput()), approval: true });
    await onInputChange(result.input || result, { rerun: false }); cancelPreview(); update(); announce(result.revision?.requiresSimulationRerun === false ? 'Visual edit undone through a new revision. Stored simulation results and seeds are unchanged.' : 'Last approved edit undone through a new revision. Simulate the restored input to update outcomes.');
  }
  async function perform(action) { try { await action(); } catch (error) { announce(error?.message || String(error), true); } }
  const actions = { 'new-building': () => newBuilding(), 'edit-world': () => { selectTab('edit'); loadProviders(); find('[data-prompt]').focus(); }, 'place-building': () => { draft = draftFromForm(); const result = validateBuildingProposal(draft); if (!result.valid) throw new Error((result.errors || []).join(' ')); onPlaceRequest(clone(draft)); announce('Placement active. Click a valid parcel in the 3D world. The building remains unapproved.'); }, 'cancel-building': () => { cancelPreview(); announce('Building proposal cancelled. Scenario inputs are unchanged.'); }, 'request-edit': proposeEdit, approve, reject: () => { cancelPreview(); announce('Proposal rejected. Inputs, results, and history are unchanged.'); }, 'edit-proposal': () => { edited = !edited; renderProposal(); }, undo };
  const click = event => { const tabButton = event.target.closest('[data-tab]'); if (tabButton) selectTab(tabButton.dataset.tab); const button = event.target.closest('[data-action]'); if (button && !button.disabled) perform(actions[button.dataset.action] || (() => {})); };
  const submit = event => { if (event.target.matches('[data-building-form]')) { event.preventDefault(); perform(reviewBuilding); } };
  root.addEventListener('click', click); root.addEventListener('submit', submit);
  find('[data-rerun]').addEventListener('change', renderProposal);
  function update(options = {}) {
    if (destroyed) return;
    if (typeof options.readOnly === 'boolean') locked = options.readOnly;
    renderProjects(); renderHistory();
    for (const element of root.querySelectorAll('[data-pane="edit"] input,[data-pane="edit"] textarea,[data-pane="edit"] select,[data-pane="edit"] button,[data-building-form] input,[data-building-form] button,.wt-entry-actions button')) element.disabled = locked;
    find('[data-status]').setAttribute('aria-live', 'polite');
    if (locked) { cancelPreview(); announce('Read-only world revision. Inspect projects and history, or make an editable copy.'); }
    if (pending) renderProposal();
  }
  update(); loadProviders();
  return {
    showProposal(proposal) { if (locked || destroyed) return; showProposal(proposal); selectTab('edit'); root.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); },
    setPlacement(proposal) { if (locked || destroyed) return; if (!proposal) { cancelPreview(); announce('Placement cancelled. Inputs and approved projects are unchanged.'); return; } draft = clone(proposal); if (!draft.id) draft.id = createBuildingProposal().id; renderBuildingForm(); onPreview(clone(draft)); announce('Building placed as a draft. Review its configuration and explicitly approve to change the scenario.'); },
    setSelection(selection) {
      selected = selection ? { ...clone(selection), placementContext: clone(selection.placementContext || selected?.placementContext || getInput().metadata?.placementContext || {}) } : null;
      if (selected && ['district', 'parameter'].includes(selected.kind) && !selected.location) { const location = findSuggestedBuildingLocation(constraints()); if (location) { selected.location = location; selected.suggested = true; } }
      find('[data-selection]').textContent = selected ? `Selected: ${selected.label || selected.id} · ${selected.kind}${selected.suggested ? ` · suggested unoccupied parcel (${selected.location.x}, ${selected.location.z} m), review before approval` : ''}` : 'No object selected · choose a building, district, or parameter.';
    },
    update,
    destroy() { if (destroyed) return; destroyed = true; request++; onPreview(null); onCancelPreview(); root.removeEventListener('click', click); root.removeEventListener('submit', submit); root.remove(); },
  };
}
