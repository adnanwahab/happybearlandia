import { renderParameterDiff } from './parameter-diff.js';

import { mountExplorationBadges } from './exploration-badges.js';
import { mountContinuity } from './continuity-view.js';
import { decisionSnapshot, localContextId } from './continuity.js';
import { housingModel, compileHousingPlan, createHousingScenarios, stressPresets, validateHousingParameters, resolveHousingModel } from '../models/housing/index.js';
import { mountBuildingWorld, buildingStateAtMonth, previewBuildingWorld } from '../buildings/renderer.js';
import { mountAdvancedStudio, setDraftParameter, setDraftUncertainty, configuredUncertaintyCurve, deleteDecisionScenario, resetScenarioAssumptions } from './advanced-studio.js';
import { getWorldRevisionId } from '../ai/edit-schema.js';
import { mountWorldTools } from './world-tools.js';
import { mountDecisionVisualizations } from './visualizations.js';
import { mountDecisionTrust } from './trust-view.js';
import { DECISION_LIMITS, normalizeDecisionInput } from './contracts.js';
import { createDecisionClient, createRunTraceCache, mergeRunTrace, parseParameterUpload, experimentInputFromManifest } from './client.js';
import { mountDiagnostics } from './diagnostics.js';
import { mountPilotRequest } from './onboarding.js';

const continuity = mountContinuity();
const initialQuery = new URLSearchParams(location.search);
const $ = selector => document.querySelector(selector);
const clone = value => structuredClone(value);
const client = createDecisionClient();
let continuityJob = null;
addEventListener('decision:optimization', event => { continuityJob = event.detail; continuity.update(decisionSnapshot({ ...(state.results || {}), selectedRun: state.selectedRun, job: continuityJob })); });
const runTraces = createRunTraceCache({loadRun:(experimentId,runId)=>client.run(experimentId,runId)});
const LOCAL_KEY = 'hbl.decision.projects.v1';
const EXAMPLE = 'Allow higher-density housing near transit stations, reduce permitting delays from 18 months to 6 months, provide $2B annually for affordable construction, and increase housing vouchers.';
const definitions = housingModel.parameters;
let activeModel = housingModel;
const state = {
  scenarios: clone(createHousingScenarios()), selected: '', metadata: {}, evidence: [],
  experiment: null, results: null, summaryResults: null, tracePending: false, traceError: null, previousResults: null, selectedRun: null, projectId: null, readonly: false, busy: false,
  needsCompile: false, dirty: false, hasRun: false, preview: false, errors: [], generation: 0, watch: null,
};
state.selected = state.scenarios.find(s => s.kind === 'plan-a')?.id || state.scenarios[0]?.id;
let previewTimer;
let traceSelectionToken = 0, automaticTraceKey = null;
let worldPreview = null, worldVisualPreview = null, constructionRun = null, constructionTimer = null, constructionMonth = 0;
let constructionView = null, worldTools = null, advancedStudio = null;
const scenario = () => state.scenarios.find(s => s.id === state.selected);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const status = (message, error = false) => { $('#app-status').textContent = message; $('#app-status').classList.toggle('error', error); if (error) { state.errors.push(message); diagnostics.update({ ...(state.results || {}), apiErrors: state.errors }); } };
const visuals = mountDecisionVisualizations($('#decision-visualizations'), { onSelectRun: selectRun, onEnterFuture: enterFuture });
const badges = mountExplorationBadges($('#decision-visualizations'));
const trust = mountDecisionTrust($('#decision-trust'));
const diagnosticsContainer = el('div'); $('#trust').append(diagnosticsContainer);
const diagnostics = mountDiagnostics(diagnosticsContainer);
const pilotContainer = el('div'); $('#trust').append(pilotContainer);
mountPilotRequest(pilotContainer, { getContext: () => ({ decision: $('#decision-text').value, modelId: housingModel.id, modelVersion: housingModel.version }) });
constructionView = mountBuildingWorld($('#building-world'), {
  projects: [], month: 0, controls: false,
  onPlace(proposal) { worldTools?.setPlacement(proposal || null); },
  onCancel() { worldTools?.setPlacement(null); },
  onSelect(selection) { worldTools?.setSelection({ ...selection, placementContext: constructionView?.placementContext }); },
  onPlacementContext(context) { worldTools?.setSelection({ kind: 'district', id: 'illustrative-city', label: 'Illustrative city · buildable context', location: context.suggestedLocation, suggested: Boolean(context.suggestedLocation), placementContext: context }); },
});
worldTools = mountWorldTools($('#world-tools'), {
  getInput: () => currentInput(), getScenarioId: () => state.selected,
  onInputChange: applyWorldRevision,
  onPreview(proposal) { worldPreview = proposal ? clone(proposal) : null; syncConstructionWorld(); },
  onPlaceRequest(proposal) { constructionView.beginPlacement(proposal); $('#building-world').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  onCancelPreview() { constructionView.cancelPlacement(); },
});
constructionView.ready?.then(() => { if (constructionView.placementContext) worldTools.setSelection({kind:'district',id:'illustrative-city',label:'Illustrative city · buildable context',location:constructionView.suggestedLocation,suggested:Boolean(constructionView.suggestedLocation),placementContext:constructionView.placementContext}); });
advancedStudio = mountAdvancedStudio($('#advanced-studio'), { getInput: () => currentInput(), getResults: () => state.results, getSelectedRun: () => state.selectedRun || constructionRun, onProposeEdit: proposeApprovedEdit, onApplyInput: proposeInputChange, onSelectRun: selectRun, onEnterFuture: enterFuture, onRunExperiment: options => runExperiment(options) });
$('#model-version').textContent = `${housingModel.label} · ${housingModel.version}`;

function collectedEvidence() {
  // Trust's local annotations are persisted under the visible experiment key.
  // Carry them into the next explicit save/run so exported/shared inputs retain sources.
  let annotations = [];
  try { annotations = JSON.parse(localStorage.getItem(`hbl:decision:evidence:${state.experiment?.id || 'draft'}`) || '[]'); } catch {}
  return [...new Map([...state.evidence, ...(Array.isArray(annotations) ? annotations : [])].map((record, index) => [record.id || `record_${index}`, record])).values()];
}
function currentInput({ runs = Number($('#run-count').value), preview = false } = {}) {
  return {
    schemaVersion: 'decision-experiment.v1', name: $('#project-name').value.trim() || 'Untitled decision',
    decision: $('#decision-text').value.trim(), modelId: activeModel.id, modelVersion: activeModel.version,
    seed: Number($('#run-seed').value), runs, years: Number($('#run-years').value),
    scenarios: clone(state.scenarios), metadata: { ...clone(state.metadata), continuity: continuity.getContext(), evidence: clone(collectedEvidence()), preview },
  };
}

function validateInput(input) {
  if (document.querySelector('#parameter-controls [aria-invalid="true"]')) throw new Error('Correct the highlighted parameter inputs before running.');
  if (!input.decision) throw new Error('Describe a decision or try the housing example first.');
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > 50) throw new Error('Choose a whole-number horizon from 1 to 50 years.');
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 4294967295) throw new Error('The matched seed must be a whole number from 0 to 4294967295.');
  if (input.runs * input.scenarios.length * (input.years + 1) > DECISION_LIMITS.maxTimelinePoints) throw new Error(`This batch exceeds the ${DECISION_LIMITS.maxTimelinePoints.toLocaleString()} yearly observation limit. Reduce the run count, years, or number of alternatives.`);
  if (!input.scenarios.some(s => s.kind === 'baseline')) throw new Error('Include a current-policy baseline.');
  for (const s of input.scenarios) {
    if (!s.name.trim()) throw new Error('Give every scenario a name.');
    const checked = validateHousingParameters(s.parameters);
    if (!checked.valid) throw new Error(`${s.name}: ${formatErrors(checked.errors)}`);
    for (const [id, u] of Object.entries(s.uncertainty || {})) {
      const definition = definitions.find(p => p.id === id);
      if (!definition) throw new Error(`Unknown uncertain parameter ${id}`);
      for (const key of ['min', 'max', 'mode', 'mean', 'value']) if (key in u && (!Number.isFinite(u[key]) || u[key] < definition.min || u[key] > definition.max)) throw new Error(`${s.name}: ${definition.label} ${key} must be between ${definition.min} and ${definition.max}.`);
      if (u.type !== 'fixed' && (!(u.min <= u.max))) throw new Error(`${s.name}: ${definition.label} uncertainty needs minimum ≤ maximum.`);
      if (u.type === 'triangular' && !(u.mode >= u.min && u.mode <= u.max)) throw new Error(`${s.name}: the triangular mode must fall inside its range.`);
      if (u.type === 'normal' && (!(u.stddev > 0) || !Number.isFinite(u.stddev))) throw new Error(`${s.name}: normal uncertainty needs a positive standard deviation.`);
    }
  }
  return normalizeDecisionInput(input, activeModel);
}
function formatErrors(errors) { return Array.isArray(errors) ? errors.map(e => typeof e === 'string' ? e : e.message || JSON.stringify(e)).join('; ') : typeof errors === 'object' ? JSON.stringify(errors) : String(errors || 'Invalid parameter values'); }

function renderScenarios() {
  if(state.scenarios.some(s=>s.inheritsFrom)){try{state.scenarios=normalizeDecisionInput(currentInput(),activeModel).scenarios;}catch(error){status(`Inherited assumptions could not be resolved: ${error.message}`,true);}}
  const tabs = $('#scenario-tabs'); tabs.replaceChildren();
  for (const s of state.scenarios) {
    const b = el('button', s.name); b.type = 'button'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(s.id === state.selected)); b.setAttribute('aria-controls', 'parameter-controls'); b.dataset.scenarioId = s.id;
    b.addEventListener('click', () => { state.selected = s.id; renderScenarios(); }); tabs.append(b);
  }
  const selected = scenario(); if (!selected) return;
  $('#scenario-name').value = selected.name; $('#scenario-kind').textContent = selected.inheritsFrom ? `${selected.kind} · inherits ${selected.inheritsFrom}` : selected.kind;
  renderStress(); renderParameters(); renderCriteriaEditor(); updateRunDescription(); applyReadonly();
  $('#delete-scenario').disabled = state.readonly || state.busy || selected.kind === 'baseline';
  if (!state.results) updateDraftTrust();
  syncConstructionWorld(); worldTools?.update(); updateAdvancedStudio();
}
function renderCriteriaEditor() {
  const selected = scenario(), mode = $('#criteria-mode');
  mode.value = selected.outcomeCriteria ? 'bands' : selected.successCriterion ? 'binary' : 'none';
  renderCriteriaFields();
}
function renderCriteriaFields() {
  const box = $('#criteria-fields'); box.replaceChildren(); const mode = $('#criteria-mode').value;
  if (mode === 'none') return;
  const selected = scenario();
  if(selected.inheritsFrom) box.append(el('p',`Replacing decision rules will detach this scenario from ${selected.inheritsFrom}. Parameter slider edits continue to use inherited overrides.`, 'fine'));
  for (const kind of mode === 'bands' ? ['success','failure'] : ['success']) {
    const existing = selected.outcomeCriteria?.[kind]?.[0] || (kind === 'success' ? selected.successCriterion : null);
    const row = el('div', undefined, 'criteria-rule'); row.dataset.criterion = kind;
    row.append(el('strong', kind === 'success' ? 'Success condition' : 'Failure condition (takes precedence)'));
    const metricLabel=el('label','Metric'), metric=el('select');metric.dataset.criteriaMetric=kind;metric.setAttribute('aria-label',`${kind} criterion metric`);
    for(const m of activeModel.metrics){const o=el('option',`${m.label} (${m.unit})`);o.value=m.id;metric.append(o);}metric.value=existing?.metricId||'affordability';metricLabel.append(metric);
    const operatorLabel=el('label','Rule'), operator=el('select');operator.dataset.criteriaOperator=kind;operator.setAttribute('aria-label',`${kind} criterion operator`);for(const [value,label]of [['gte','At least ≥'],['lte','At most ≤']]){const o=el('option',label);o.value=value;operator.append(o);}operator.value=existing?.operator||(kind==='failure'?'lte':'gte');operatorLabel.append(operator);
    const valueLabel=el('label','Threshold'),value=el('input');value.type='number';value.step='any';value.value=existing?.value??(kind==='failure'?60:70);value.dataset.criteriaValue=kind;value.setAttribute('aria-label',`${kind} criterion threshold`);valueLabel.append(value);row.append(metricLabel,operatorLabel,valueLabel);box.append(row);
  }
  if (selected.outcomeCriteria && (selected.outcomeCriteria.success.length > 1 || selected.outcomeCriteria.failure.length > 1)) box.append(el('p','This experiment contains multiple stored rules. Applying this simple editor replaces them with the displayed single success/failure rules.','fine'));
  applyReadonly();
}
$('#criteria-mode').addEventListener('change', renderCriteriaFields);
$('#apply-criteria').addEventListener('click', () => safe(() => {
  if(state.readonly||state.busy)return;const selected=scenario(),mode=$('#criteria-mode').value;
  const rule=kind=>{const raw=$(`[data-criteria-value="${kind}"]`).value;if(!raw.trim()||!Number.isFinite(Number(raw)))throw new Error('Choose a finite numerical threshold.');return{metricId:$(`[data-criteria-metric="${kind}"]`).value,operator:$(`[data-criteria-operator="${kind}"]`).value,value:Number(raw)};};
  const criteria = mode === 'binary' ? {successCriterion:rule('success')} : mode === 'bands' ? {outcomeCriteria:{success:[rule('success')],failure:[rule('failure')]}} : {};
  const inherited = selected.inheritsFrom; if(inherited){delete selected.inheritsFrom;delete selected.overrides;}
  delete selected.successCriterion;delete selected.outcomeCriteria;Object.assign(selected,criteria);
  if(inherited)$('#scenario-kind').textContent=`${selected.kind} · detached from ${inherited} to replace decision rules`;
  markDirty();status(mode==='none'?'Outcome thresholds cleared from the draft. New results will be unclassified until criteria are recorded.':'Decision rules applied to the draft. Run this revision to classify its actual futures.');
}));
$('#delete-scenario').addEventListener('click', () => safe(() => {if(state.readonly||state.busy)return;const next=deleteDecisionScenario(currentInput(),state.selected);loadInput(next);markDirty();status('Alternative deleted from this draft. Stored experiments and the current-policy baseline remain unchanged.');}));
$('#reset-scenario').addEventListener('click', () => safe(() => {if(state.readonly||state.busy)return;const id=state.selected,next=resetScenarioAssumptions(currentInput(),id,createHousingScenarios());loadInput(next);state.selected=id;renderScenarios();markDirty();status('Selected scenario assumptions reset to model defaults. Specific building projects and approved history were preserved.');}));

function renderStress() {
  const container = $('#stress-presets'); container.replaceChildren();
  for (const preset of stressPresets) {
    const label = el('label'); const check = el('input'); check.type = 'checkbox'; check.value = preset.id;
    check.checked = (scenario().stressPresets || []).includes(preset.id); check.disabled = state.readonly;
    check.addEventListener('change', () => {
      const selected = scenario(); selected.stressPresets ||= [];
      selected.stressPresets = check.checked ? [...new Set([...selected.stressPresets, preset.id])] : selected.stressPresets.filter(id => id !== preset.id);
      if(selected.inheritsFrom){selected.overrides ||= {};selected.overrides.stressPresets=clone(selected.stressPresets);}
      markDirty();
    }); label.append(check, document.createTextNode(preset.label || preset.name || preset.id)); container.append(label);
  }
  $('#stress-details').open = scenario()?.kind === 'stress';
}
function renderParameters() {
  const container = $('#parameter-controls'); container.replaceChildren();
  const selected = scenario(); if (!selected) return;
  selected.parameters ||= {}; selected.uncertainty ||= {};
  const priority = ['permitting_months', 'zoning_density', 'construction_capacity', 'subsidy_amount', 'voucher_funding', 'adoption', 'implementation_delay', 'interest_rate', 'migration'];
  const ordered = [...definitions].sort((a, b) => (priority.includes(a.id) ? priority.indexOf(a.id) : priority.length) - (priority.includes(b.id) ? priority.indexOf(b.id) : priority.length));
  const policyIds = new Set(['permitting_months','zoning_density','subsidy_amount','voucher_funding','adoption','implementation_delay','funding_delivery','transit_share','resistance']);
  const groups = {};
  for (const [id, title] of [['policy','Policy levers'],['world','World assumptions']]) { const group = el('section', undefined, 'parameter-group'); group.dataset.controlGroup = id; group.append(el('h3', title)); container.append(group); groups[id] = group; }
  for (const definition of ordered) {
    const row = el('article', undefined, 'parameter-row'); row.dataset.parameterId = definition.id;
    const top = el('div', undefined, 'parameter-top'); const label = el('label', definition.label); label.htmlFor = `parameter-${definition.id}`;
    const unit = el('span', ` ${definition.unit}`, 'unit'); label.append(unit);
    const number = el('input', undefined, 'parameter-value'); number.type = 'number'; number.id = `parameter-${definition.id}`;
    number.min = String(definition.min); number.max = String(definition.max); number.step = 'any';
    number.value = String(selected.parameters[definition.id] ?? definition.default); number.setAttribute('aria-label', `${definition.label} (${definition.unit})`);
    const range = el('input'); range.type = 'range'; range.min = number.min; range.max = number.max;
    range.step = 'any'; range.value = number.value; range.setAttribute('aria-label', `${definition.label} slider`);
    function edit(input) {
      if (state.readonly || !input.value.trim() || !input.checkValidity()) { input.setAttribute('aria-invalid', 'true'); return; }
      const value = Number(input.value); if (!Number.isFinite(value)) return;
      setDraftParameter(selected,definition.id,value); number.value = range.value = String(value); number.removeAttribute('aria-invalid');
      // Direct value edits become fixed inputs so a retained distribution cannot silently override the slider.
      distribution.value = 'fixed'; renderFields();
      renderChange(); renderCurve(); markDirty();
    }
    number.addEventListener('focus', () => worldTools?.setSelection({ kind: 'parameter', id: definition.id, label: definition.label }));
    number.addEventListener('input', () => edit(number)); range.addEventListener('input', () => edit(range));
    const changeIndicator = el('span', '', 'changed-indicator');
    const renderChange = () => { const baseline = state.scenarios.find(s => s.kind === 'baseline'); const before = baseline?.parameters?.[definition.id] ?? definition.default; const value = selected.parameters[definition.id] ?? definition.default; const delta = value - before; changeIndicator.classList.toggle('changed', Math.abs(delta) > 1e-10); changeIndicator.textContent = delta === 0 ? selected.kind === 'baseline' ? 'Current-policy baseline' : 'Same as baseline' : `${delta > 0 ? '+' : ''}${new Intl.NumberFormat(undefined,{maximumFractionDigits:4}).format(delta)} ${definition.unit} vs baseline (${before})`; };
    top.append(label, number); row.append(top, changeIndicator, range, el('p', definition.description)); renderChange();
    const source = selected.parameters[definition.id] === definition.default ? 'Model default · illustrative, low confidence' : 'Reviewed scenario input · user editable';
    row.append(el('p', source + ' · Direct slider edits use a fixed value.', 'parameter-source'));
    const uncertainty = el('div', undefined, 'uncertainty'); const distribution = el('select'); distribution.setAttribute('aria-label', `${definition.label} uncertainty`);
    for (const type of ['fixed', 'uniform', 'triangular', 'normal']) { const option = el('option', type === 'fixed' ? 'Fixed value' : type[0].toUpperCase() + type.slice(1)); option.value = type; distribution.append(option); }
    distribution.value = selected.uncertainty[definition.id]?.type || 'fixed';
    const fields = el('div', undefined, 'distribution-fields');
    const mini = document.createElementNS('http://www.w3.org/2000/svg','svg'); mini.classList.add('uncertainty-mini'); mini.setAttribute('viewBox','0 0 240 32'); mini.setAttribute('role','img');
    function renderCurve() {
      const configured = configuredUncertaintyCurve(definition, selected.uncertainty[definition.id], selected.parameters[definition.id] ?? definition.default); mini.replaceChildren(); mini.setAttribute('aria-label', `${definition.label}: configured ${configured.type} distribution, ${configured.min} to ${configured.max} ${definition.unit}; not observed data`);
      const line = document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1','4');line.setAttribute('x2','236');line.setAttribute('y1','28');line.setAttribute('y2','28');mini.append(line);
      if (configured.type === 'fixed') { const fixed = document.createElementNS('http://www.w3.org/2000/svg','line');const x=4+Math.max(0,Math.min(1,(configured.min-definition.min)/(definition.max-definition.min||1)))*232;fixed.setAttribute('x1',x);fixed.setAttribute('x2',x);fixed.setAttribute('y1','5');fixed.setAttribute('y2','28');mini.append(fixed); }
      else { const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M4,28 ${configured.points.map(([x,y])=>`L${4+x*232},${28-y*24}`).join(' ')} L236,28 Z`);mini.append(path); }
    }
    const renderFields = () => {
      fields.replaceChildren(); const u = selected.uncertainty[definition.id]; if (!u || u.type === 'fixed') return;
      const keys = u.type === 'triangular' ? ['min', 'mode', 'max'] : u.type === 'normal' ? ['min', 'mean', 'max', 'stddev'] : ['min', 'max'];
      for (const key of keys) {
        const label = el('label', key === 'stddev' ? 'Std dev' : key); const input = el('input'); input.type = 'number'; input.step = 'any'; input.value = String(u[key]);
        input.setAttribute('aria-label', `${definition.label} ${key}`); input.disabled = state.readonly;
        input.addEventListener('input', () => { if (input.value.trim() && Number.isFinite(Number(input.value))) { u[key] = Number(input.value); setDraftUncertainty(selected,definition.id,u); input.removeAttribute('aria-invalid'); } else input.setAttribute('aria-invalid', 'true'); renderCurve(); markDirty(); }); label.append(input); fields.append(label);
      }
    };
    distribution.addEventListener('change', () => {
      const type = distribution.value, value = selected.parameters[definition.id] ?? definition.default;
      if (type === 'fixed') setDraftUncertainty(selected,definition.id,null);
      else {
        const span = (definition.max - definition.min) * .08;
        const min = Math.max(definition.min, value - span), max = Math.min(definition.max, value + span);
        selected.uncertainty[definition.id] = { type, min, max, ...(type === 'triangular' ? { mode: value } : {}), ...(type === 'normal' ? { mean: value, stddev: Math.max((max - min) / 6, .000001) } : {}) };
      }
      setDraftUncertainty(selected,definition.id,selected.uncertainty[definition.id] || null); renderFields(); renderCurve(); markDirty();
    });
    renderFields(); renderCurve(); uncertainty.append(distribution, fields); row.append(mini, uncertainty); const role = definition.role || definition.controlGroup || definition.parameterRole; const group = /policy|lever/.test(role || '') || !role && policyIds.has(definition.id) ? 'policy' : 'world'; groups[group].append(row);
  }
}
function updateParameterDiff() { renderParameterDiff($('#scenario-parameter-diff'), currentInput(), activeModel, state.selected); }
function updateRunDescription() { updateParameterDiff(); $('#run-description').textContent = `${Number($('#run-count').value).toLocaleString()} futures × ${state.scenarios.length} scenarios. Same seed sequence, different choices.`; }
function updateDraftTrust() { trust.update({ experiment: currentInput(), runs: [], aggregates: [], comparisons: [], model: activeModel, evidence: collectedEvidence(), readOnly: state.readonly }); }
function markDirty() {
  updateParameterDiff();
  if (state.readonly) return;
  // Input edits supersede pending create/start/reopen requests as well as polls.
  // The server may finish its immutable record; it no longer owns this draft.
  activeRequest++;
  state.watch?.destroy(); state.watch = null;
  traceSelectionToken++; state.tracePending = false;
  if (state.busy) setBusy(false);
  state.dirty = true; state.generation++; updateAdvancedStudio(); $('#share-experiment').disabled = true;
  if (!state.results) updateDraftTrust();
  $('#result-context').textContent = state.results ? 'Assumptions changed. Results below belong to the previous experiment until a new run finishes.' : 'Assumptions ready. Run the experiment to explore outcomes.';
  clearTimeout(previewTimer);
  if (state.hasRun && $('#auto-preview').checked) previewTimer = setTimeout(() => {
    if (!state.busy && !state.readonly) safe(() => runExperiment({ preview: true }));
  }, 650);
}
function showCompileReport(result) {
  const box = $('#compile-report'); box.replaceChildren();
  box.append(el('p', 'Plan statement → explicit assumptions → editable values'));
  const list = el('ul');
  for (const a of result.assumptions || []) list.append(el('li', typeof a === 'string' ? a : a.description || a.assumption || a.label || a.note || JSON.stringify(a)));
  if (list.children.length) box.append(list);
  for (const warning of result.warnings || []) box.append(el('p', typeof warning === 'string' ? warning : warning.message || JSON.stringify(warning), 'compile-warning'));
  box.append(el('p', 'Compiled assumptions are model interpretations, not verified facts.'));
}
function compilePlan() {
  if (state.readonly) return;
  const text = $('#decision-text').value.trim(); if (!text) throw new Error('Describe a housing decision first.');
  const compiled = compileHousingPlan(text); state.needsCompile = false;
  const target = state.scenarios.find(s => s.kind === 'plan-a') || scenario();
  target.parameters = { ...target.parameters, ...compiled.parameters };
  // Keep the stress alternative paired to the newly compiled proposal.
  for (const s of state.scenarios.filter(s => s.kind === 'stress')) s.parameters = { ...s.parameters, ...compiled.parameters };
  state.selected = target.id;
  state.metadata.compilation = { text, assumptions: compiled.assumptions || [], warnings: compiled.warnings || [], compiledAt: new Date().toISOString() };
  showCompileReport(compiled); renderScenarios(); markDirty(); status('Plan compiled. Review Plan A’s values and uncertainty before simulating.');
}
function useExample() {
  if (state.busy) throw new Error('Cancel the running experiment before loading another project.');
  activeModel = housingModel; resetResults(); setReadonly(false); state.scenarios = clone(createHousingScenarios()); state.selected = state.scenarios.find(s => s.kind === 'plan-a')?.id || state.scenarios[0].id;
  state.metadata = {}; state.evidence = []; state.projectId = null; $('#project-name').value = 'Affordable Housing Plan'; $('#decision-text').value = EXAMPLE;
  compilePlan(); $('#studio').scrollIntoView({ behavior: 'smooth' });
}

function setBusy(busy) {
  state.busy = busy; updateAdvancedStudio(); $('#run-experiment').disabled = busy || state.readonly; $('#cancel-experiment').disabled = !busy || state.readonly || state.experiment?.status !== 'running';
  $('#save-experiment').disabled = busy || state.readonly; $('#try-example').disabled = busy;
}
function successfulRuns(runs = []) { return runs.filter(run => ['completed', 'successful', 'succeeded'].includes(run.status) && !run.error && run.metrics && Object.values(run.metrics).some(Number.isFinite)); }
function renderResults(result) {
  state.experiment = result.experiment || state.experiment;
  runTraces.setExperiment(state.experiment?.id || null);
  const summaryRows = successfulRuns(result.runs);
  const data = { ...result, experiment: state.experiment, runs: summaryRows.map(row=>mergeRunTrace(row,runTraces.peek(state.experiment.id,row.id))), previousResults: state.previousResults, model: result.model || resolveHousingModel(state.experiment?.modelVersion || activeModel.version).model, readOnly: state.readonly, evidence: state.evidence, apiErrors: state.errors };
  state.summaryResults = {...data,runs:summaryRows,previousResults:undefined};
  continuity.update(decisionSnapshot({ ...data, job: continuityJob, selectedRun: state.selectedRun }), { namespace: 'decision', experimentId: state.experiment?.id });
  state.results = data; badges.update(data); visuals.update(data); trust.update(data); diagnostics.update(data);
  syncConstructionWorld(); worldTools?.update(); updateAdvancedStudio();
  const experiment = state.experiment;
  updateExecutiveSummary();
  const p = experiment?.progress || {};
  const total = p.total ?? (experiment?.runs || 0) * (experiment?.scenarios?.length || 0), completed = p.completed || 0;
  $('#run-progress').max = total || 1; $('#run-progress').value = completed;
  $('#progress-count').textContent = `${completed.toLocaleString()} / ${total.toLocaleString()}`;
  $('#successful-count').textContent = String(p.successful ?? data.runs.length); $('#failed-count').textContent = String(p.failed || 0);
  $('#elapsed-time').textContent = `${((p.elapsedMs || 0) / 1000).toFixed(1)}s`;
  $('#run-state').textContent = `${experiment?.metadata?.resultsSourceExperimentId ? 'Saved visual revision · ' : state.preview ? '10-run preview · ' : ''}${experiment?.status || 'Ready'}`;
  $('#share-experiment').disabled = !experiment?.id || !['completed', 'cancelled'].includes(experiment.status);
  $('#download-manifest').disabled = !experiment?.id; $('#reproduce-experiment').disabled = !experiment?.id || state.readonly;
  const when = state.preview ? '10-run preview' : `${experiment?.runs || 0}-run experiment`;
  $('#result-context').textContent = experiment?.metadata?.resultsSourceExperimentId ? `Saved visual revision. ${data.runs.length} original stored futures reused from ${experiment.metadata.resultsSourceExperimentId}; no simulations rerun.` : `${state.dirty ? 'Inputs changed since this run. ' : ''}Showing ${when}, ${data.runs.length.toLocaleString()} successful futures. ${experiment?.modelVersion || housingModel.version}.`;
}
async function runExperiment({ preview = false, reproduction = null } = {}) {
  if (state.readonly || state.busy) return;
  if (state.needsCompile && !reproduction) { compilePlan(); status('Your edited decision has been compiled. Review the visible assumptions, then click Simulate this plan.'); return; }
  clearTimeout(previewTimer);
  const input = validateInput(reproduction || currentInput({ runs: preview ? 10 : Number($('#run-count').value), preview }));
  if (state.results?.runs?.length) state.previousResults = { ...(state.summaryResults || state.results), previousResults: undefined };
  state.selectedRun = null; constructionRun = null; traceSelectionToken++; automaticTraceKey=null; state.tracePending=false;state.traceError=null; runTraces.clear();
  const revision = state.generation; state.preview = preview; state.dirty = false; state.hasRun = true;
  setBusy(true); status(preview ? 'Recalculating 10 paired futures per scenario…' : 'Creating your experiment and simulating possible futures…');
  state.watch?.destroy(); const token = ++activeRequest;
  try {
    const created = await client.create(input); if (token !== activeRequest) return;
    state.experiment = created.experiment;
    const started = await client.start(state.experiment.id); if (token !== activeRequest) return;
    state.experiment = started.experiment || state.experiment; state.evidence = clone(input.metadata?.evidence || []); setBusy(true);
    updateExperimentUrl(state.experiment.id);
    state.watch = client.watch(state.experiment.id, {
      onUpdate(result) {
        if (token !== activeRequest) return;
        state.dirty = revision !== state.generation;
        renderResults(result);
        if (['completed', 'cancelled', 'failed'].includes(result.experiment?.status)) {
          setBusy(false);
          if (result.experiment.status === 'failed') status(result.experiment.error || 'The experiment failed. Review diagnostics and try again.', true);
          else status(`${preview ? 'Preview' : 'Experiment'} ${result.experiment.status}. ${successfulRuns(result.runs).length.toLocaleString()} actual successful futures available to explore.`);
          if (state.dirty && $('#auto-preview').checked) previewTimer = setTimeout(() => safe(() => runExperiment({ preview: true })), 650);
          refreshExperiments().catch(() => {});
        }
      },
      onError(error) { if (token !== activeRequest) return; setBusy(false); status(`Could not refresh results: ${error.message}. Use Reopen experiment to reconnect.`, true); },
    });
  } catch (error) { if (token === activeRequest) { setBusy(false); status(error.message, true); } }
}
let activeRequest = 0;
function updateExperimentUrl(id) { const url = new URL(location.href); url.searchParams.set('experiment', id); url.searchParams.delete('demo'); url.searchParams.delete('share'); if (!state.readonly) url.searchParams.delete('readonly'); history.replaceState(null, '', url); }
function setReadonly(value) {
  state.readonly = value; worldTools?.update({readOnly: value}); document.body.classList.toggle('readonly', value); $('#readonly-banner').hidden = !value; applyReadonly();
  if (state.results) trust.update({ ...state.results, readOnly: value });
  updateAdvancedStudio();
}
function applyReadonly() {
  for (const input of document.querySelectorAll('.analyst-controls input, .analyst-controls select, .analyst-controls textarea, .analyst-controls button')) input.disabled = state.readonly;
  // Tabs inspect scenarios even in a read-only share.
  for (const button of $('#scenario-tabs').querySelectorAll('button')) button.disabled = false;
  $('#delete-scenario').disabled = state.readonly || state.busy || scenario()?.kind === 'baseline'; $('#reset-scenario').disabled = state.readonly || state.busy; $('#apply-criteria').disabled = state.readonly || state.busy;
  $('#executive-toggle').disabled = false; $('#upgrade-model').disabled = state.readonly;
  $('#run-experiment').disabled = state.busy || state.readonly; $('#cancel-experiment').disabled = !state.busy || state.readonly;
  $('#reproduce-experiment').disabled = !state.experiment?.id || state.readonly;
  $('#apply-import').disabled = state.readonly || !upload;
}
async function reopenExperiment(id, readonly = false) {
  if (!id) throw new Error('Choose an experiment to reopen.');
  if (state.busy) throw new Error('Cancel the running experiment before opening another.');
  clearTimeout(previewTimer); state.watch?.destroy(); runTraces.clear();traceSelectionToken++;automaticTraceKey=null;const token = ++activeRequest;
  status('Opening saved experiment…');
  let result;
  try { result = readonly ? await client.share(id) : await client.results(id); }
  catch (error) { if (token !== activeRequest) return; throw error; }
  if (token !== activeRequest) return;
  if (!result.experiment) throw new Error('The server did not return an experiment.');
  state.results=null;state.summaryResults=null;state.selectedRun=null;constructionRun=null;state.experiment=result.experiment;runTraces.setExperiment(result.experiment.id);
  loadInput(result.experiment); setReadonly(readonly); state.preview = Boolean(result.experiment.metadata?.preview); state.hasRun = true; state.dirty = false;
  renderResults(result); updateExperimentUrl(id); status(readonly ? 'Read-only experiment opened. Explore the original inputs, futures, and decision brief.' : 'Experiment reopened with its original inputs and results.');
  if (result.experiment.status === 'running') {
    setBusy(true); state.watch = client.watch(id, { onUpdate(next) { if (token !== activeRequest) return; renderResults(next); if (['completed', 'cancelled', 'failed'].includes(next.experiment?.status)) setBusy(false); }, onError(error) { if (token !== activeRequest) return; setBusy(false); status(error.message, true); } });
  }
}
function loadInput(input) {
  if (input.metadata?.continuity) { try { continuity.restoreContext(input.metadata.continuity); } catch (error) { status(`Saved world context unavailable: ${error.message}`); } }
  const resolvedModel = resolveHousingModel(input.modelVersion || housingModel.version).model;
  input = normalizeDecisionInput(input, resolvedModel); activeModel = resolvedModel;
  $('#legacy-model-banner').hidden = activeModel.version === housingModel.version;
  $('#upgrade-model').disabled = state.readonly;
  $('#model-version').textContent = `${activeModel.label} · ${activeModel.version}`;
  state.needsCompile = false; state.scenarios = clone(input.scenarios); state.metadata = clone(input.metadata || {}); state.evidence = clone(input.metadata?.evidence || []);
  state.selected = state.scenarios.find(s => s.kind === 'plan-a')?.id || state.scenarios[0]?.id;
  $('#project-name').value = input.name || 'Imported decision'; $('#decision-text').value = input.decision || '';
  $('#run-years').value = input.years || 10; $('#run-seed').value = input.seed ?? 42;
  const runs = Number(input.runs || 100); if (![10, 100, 500, 1000].includes(runs)) { const option = el('option', String(runs)); option.value = String(runs); $('#run-count').append(option); } $('#run-count').value = String(runs);
  $('#compile-report').replaceChildren(); if (state.metadata.compilation) showCompileReport(state.metadata.compilation);
  renderScenarios();
}
async function applyWorldRevision(input, { rerun = false } = {}) {
  if (state.readonly) throw new Error('Make an editable copy before approving changes.');
  if (state.busy) throw new Error('Cancel or finish the current experiment before applying a new revision.');
  const selectedId = state.selected;
  clearTimeout(previewTimer);
  if (!input.decision?.trim()) input = { ...input, decision: 'Compare housing-policy alternatives and the approved world interventions.' };
  const mathChanged = Boolean(input.metadata?.worldRevision?.requiresSimulationRerun);
  let savedVisualRevision = null;
  if (!mathChanged && !state.dirty && state.experiment?.status === 'completed' && state.results?.runs?.length) {
    // The server verifies exact numerical-input equality and creates a separate
    // immutable completed record referencing the already calculated rows.
    const sameMathInput = { ...input, runs: state.experiment.runs };
    savedVisualRevision = await client.visualRevision(state.experiment.id, sameMathInput);
    input = savedVisualRevision.experiment;
  }
  loadInput(input);
  if (state.scenarios.some(s => s.id === selectedId)) state.selected = selectedId;
  state.generation++; state.dirty = mathChanged || state.dirty;
  worldPreview = null; worldVisualPreview = null;
  renderScenarios();
  if (savedVisualRevision) { state.dirty = false; state.preview = Boolean(savedVisualRevision.experiment.metadata?.preview); renderResults(savedVisualRevision); updateExperimentUrl(savedVisualRevision.experiment.id); refreshExperiments().catch(() => {}); }
  try { saveProject(false, true); } catch (error) { status(`Revision retained in this session, but local storage failed: ${error.message}. Export the editable project to preserve it.`, true); }
  if (mathChanged || state.dirty) $('#share-experiment').disabled = true;
  $('#result-context').textContent = mathChanged ? 'A new world revision was approved. Existing results describe the previous input. Simulate this revision to update outcomes.' : 'Visual revision approved. Existing simulation results and matched seeds are unchanged.';
  if (rerun) {
    try { await runExperiment({ preview: true }); }
    catch (error) { const message = `World revision approved, but simulation could not start: ${error.message}. Use Simulate this plan to retry.`; status(message, true); return { simulationError: message }; }
  }
  else status(mathChanged ? 'World revision approved. Run the experiment when ready; previous results remain unchanged.' : 'Appearance updated through an approved revision. Simulation mathematics were not changed.');
}
function syncConstructionWorld() {
  if (state.experiment?.id) continuity.update(decisionSnapshot({ ...(state.results || {}), job: continuityJob, selectedRun: constructionRun }), { namespace: 'decision', experimentId: state.experiment.id, runId: constructionRun?.id, scenarioId: constructionRun?.scenarioId, branchId: constructionRun?.lineage?.branchId, tick: Math.max(0, Math.floor(constructionMonth)) });
  if (!constructionView) return;
  const current = scenario(); if (!current) return;
  $('#open-neighborhood-world').href = state.experiment?.id ? `/world?decisionExperiment=${encodeURIComponent(state.experiment.id)}` : '/world';
  $('#open-neighborhood-world').textContent = state.experiment?.id ? 'Open this stored experiment in the neighborhood world ↗' : 'Open the neighborhood world ↗';
  const scenarioSelect = $('#building-scenario');
  const wantedOptions = state.scenarios.map(s => `${s.id}:${s.name}`).join('|');
  if (scenarioSelect.dataset.options !== wantedOptions) {
    scenarioSelect.replaceChildren();
    for (const s of state.scenarios) { const option = el('option', s.name); option.value = s.id; scenarioSelect.append(option); }
    scenarioSelect.dataset.options = wantedOptions;
  }
  scenarioSelect.value = current.id;
  const runs = (state.results?.runs || []).filter(run => run.scenarioId === current.id);
  constructionRun = runs.find(run => run.id === constructionRun?.id) || runs[0] || null;
  if (state.selectedRun) state.selectedRun = runs.find(run => run.id === state.selectedRun.id) || null;
  const runSelect = $('#building-run'), previous = runSelect.value;
  const runKey = `${state.experiment?.id || 'draft'}:${current.id}:${runs.length}`;
  if (runSelect.dataset.options !== runKey) {
    runSelect.replaceChildren();
    if (!runs.length) { const option = el('option', 'No stored future yet'); option.value = ''; runSelect.append(option); }
    for (const [index, run] of runs.entries()) { const option = el('option', `Future ${index + 1} · seed ${run.seed}`); option.value = run.id; runSelect.append(option); }
    runSelect.dataset.options = runKey;
  }
  runSelect.value = constructionRun?.id || previous;
  const savedScenario = state.results?.experiment?.scenarios?.find(s => s.id === current.id);
  // Replay uses the exact saved project's geometry with stored monthly output.
  // Approved-but-unrun input is shown separately as a proposed ghost.
  let projects = clone(savedScenario?.projects || current.projects || []);
  if (savedScenario && state.dirty) for (const project of current.projects || []) {
    if (!savedScenario.projects?.some(previous => previous.id === project.id)) projects.push({ ...clone(project), status: 'proposed' });
  }
  const preview = previewBuildingWorld({ projects, worldVisuals: current.worldVisuals || savedScenario?.worldVisuals || {} }, worldPreview);
  projects = preview.projects;
  const maxMonth = Math.max(1, (state.results?.experiment?.years || Number($('#run-years').value) || 10) * 12);
  constructionMonth = Math.max(0, Math.min(maxMonth, constructionMonth));
  $('#building-month').max = String(maxMonth); $('#building-month').value = String(constructionMonth); $('#building-month-label').textContent = String(constructionMonth);
  $('#building-month').setAttribute('aria-valuetext', `Month ${constructionMonth}`);
  const unloadedTrace = constructionRun?.traceDelivery === 'on-demand';
  $('#building-play').disabled = !constructionRun || unloadedTrace;
  constructionView.update({ projects, run: unloadedTrace ? null : constructionRun, month: constructionMonth, worldVisuals: preview.worldVisuals });
  if (state.experiment?.id) { const target = new URL('/world',location.origin);target.searchParams.set('decisionExperiment',state.experiment.id); if(constructionRun)target.searchParams.set('decisionRun',constructionRun.id);target.searchParams.set('month',String(constructionMonth));$('#open-neighborhood-world').href=target.pathname+target.search; }
  $('#building-context').textContent = unloadedTrace ? `${current.name} · ${constructionRun.id}: complete monthly/project states are stored and available on demand. ${state.traceError || 'Loading the selected future’s full replay trace…'}` : constructionRun ? `${current.name} · stored future ${constructionRun.id} · model ${constructionRun.modelVersion} · month ${constructionMonth}. ${state.dirty ? 'Input revisions are newer than these stored results.' : 'Phases, completed homes, occupancy, and spending come from stored monthly states.'}` : 'Unapproved / unrun world. Approve a project and simulate to replay its actual construction.';
  const summary = $('#building-project-summary'); summary.replaceChildren();
  for (const project of savedScenario?.projects || current.projects || []) {
    const stored = buildingStateAtMonth(unloadedTrace ? null : constructionRun, project, constructionMonth);
    const card = el('article'); card.append(el('strong', project.name));
    card.append(el('p', unloadedTrace ? 'Full monthly trace is stored, not missing. Loading this selected future before replay.' : `${stored.status} · ${Math.round((stored.progress || 0) * 100)}% · floor ${stored.floorsBuilt || 0}/${project.geometry.floors} · ${stored.completedUnits || 0} completed homes · ${stored.occupiedUnits || 0} occupied`)); summary.append(card);
  }
  if(unloadedTrace && state.experiment?.id) {const key=`${state.experiment.id}/${constructionRun.id}`;if(automaticTraceKey!==key){automaticTraceKey=key;void hydrateVisibleRun(constructionRun);}}
}
function stopConstructionPlayback() { clearInterval(constructionTimer); constructionTimer = null; $('#building-play').textContent = 'Play'; $('#building-play').setAttribute('aria-label', 'Play construction'); }
$('#building-scenario').addEventListener('change', () => { state.selected = $('#building-scenario').value; constructionRun = null; constructionMonth = 0; stopConstructionPlayback(); renderScenarios(); });
$('#building-run').addEventListener('change', () => {const run=state.results?.runs.find(row=>row.id===$('#building-run').value);if(run)void selectRun(run);});
$('#building-month').addEventListener('input', () => { constructionMonth = Number($('#building-month').value); syncConstructionWorld(); });
$('#building-reset').addEventListener('click', () => { stopConstructionPlayback(); constructionMonth = 0; syncConstructionWorld(); });
$('#building-play').addEventListener('click', () => {
  if (constructionTimer) { stopConstructionPlayback(); return; }
  if (!constructionRun) return;
  if (constructionMonth >= Number($('#building-month').max)) constructionMonth = 0;
  $('#building-play').textContent = 'Pause'; $('#building-play').setAttribute('aria-label', 'Pause construction');
  constructionTimer = setInterval(() => { constructionMonth += Number($('#building-speed').value); if (constructionMonth >= Number($('#building-month').max)) stopConstructionPlayback(); syncConstructionWorld(); }, 200);
});

function updateAdvancedStudio() {
  advancedStudio?.update({ input: currentInput(), results: state.results, selectedRun: state.selectedRun || constructionRun, previousResults: state.previousResults, readOnly: state.readonly, busy: state.busy, stale: state.dirty, scenarioId: state.selected, month: constructionMonth });
}
function proposeApprovedEdit(proposal) {
  if (state.readonly) throw new Error('Make an editable copy before proposing an edit.');
  if (state.busy) throw new Error('Wait for or cancel the current experiment before reviewing a new edit.');
  const target = proposal.scenarioId || proposal.targetScenarioId;
  if (target && !state.scenarios.some(s => s.id === target)) throw new Error('The proposal targets a scenario that is not in this draft. Reopen its experiment before reviewing the fix.');
  if (target && state.scenarios.some(s => s.id === target)) { state.selected = target; renderScenarios(); }
  document.body.classList.remove('entered-future','executive-mode'); $('#future-entry-banner').hidden=true; $('#executive-summary').hidden=true; $('#executive-toggle').setAttribute('aria-pressed','false'); $('#executive-toggle').textContent='Executive mode';
  worldTools.showProposal(proposal); $('#physical-world').scrollIntoView({behavior:'smooth',block:'start'});
}
function proposeInputChange(next) {
  if (state.readonly || state.busy) throw new Error('Use an editable, idle project to review a proposed input.');
  if (next?.input) next = next.input;
  const input = currentInput(), operations = [];
  if (!next?.scenarios) throw new Error('A complete proposed experiment input is required.');
  if (next.modelId !== input.modelId || next.modelVersion !== input.modelVersion || next.seed !== input.seed || next.years !== input.years) throw new Error('Review model, seed and horizon changes in the primary experiment controls.');
  if(input.scenarios.some(s=>!next.scenarios.some(proposed=>proposed.id===s.id)))throw new Error('Delete alternatives using the protected scenario controls in the primary studio.');
  for (const proposed of next.scenarios) {
    const original = input.scenarios.find(s => s.id === proposed.id);
    if (!original) { operations.push({op:'add_scenario',target:'scenarios',value:proposed}); continue; }
    if (JSON.stringify(original) === JSON.stringify(proposed)) continue;
    if (proposed.name !== original.name) throw new Error('Rename an existing alternative using its scenario-name field.');
    for(const field of ['successCriterion','outcomeCriteria'])if(JSON.stringify(proposed[field])!==JSON.stringify(original[field]))throw new Error('Review decision-rule changes in the visible success/mixed/failure editor.');
    if((original.stressPresets||[]).some(id=>!proposed.stressPresets?.includes(id)))throw new Error('Remove stress presets using the visible scenario stress controls.');
    if((original.scheduledStress||[]).some(stress=>!proposed.scheduledStress?.some(row=>JSON.stringify(row)===JSON.stringify(stress))))throw new Error('This proposal removes a scheduled stress. Review that change in a separate new alternative.');
    if (proposed.id !== state.selected) throw new Error('Review one existing scenario at a time, or add a new alternative.');
    for (const [id,value] of Object.entries(proposed.parameters || {})) if (value !== original.parameters?.[id]) operations.push({op:'set_parameter',target:id,value});
    for(const id of Object.keys(original.uncertainty||{}))if(!proposed.uncertainty?.[id]&&proposed.parameters?.[id]===original.parameters?.[id])operations.push({op:'set_parameter',target:id,value:proposed.parameters[id]});
    for (const [id,value] of Object.entries(proposed.uncertainty || {})) if (JSON.stringify(value) !== JSON.stringify(original.uncertainty?.[id])) operations.push({op:'set_uncertainty',target:id,value});
    for (const id of proposed.stressPresets || []) if (!original.stressPresets?.includes(id)) operations.push({op:'apply_stress_preset',target:'stressPresets',value:id});
    for(const stress of proposed.scheduledStress||[])if(!original.scheduledStress?.some(row=>JSON.stringify(row)===JSON.stringify(stress)))operations.push({op:'apply_stress_preset',target:'stressPresets',value:stress});
    for (const project of proposed.projects || []) { const old=original.projects?.find(p=>p.id===project.id); if(!old) operations.push({op:'add_building',target:'world.projects',value:project}); else if(JSON.stringify(old)!==JSON.stringify(project)) operations.push({op:'update_building',target:project.id,value:project}); }
    for (const project of original.projects || []) if (!proposed.projects?.some(p=>p.id===project.id)) operations.push({op:'remove_building',target:project.id});
    for (const [key,value] of Object.entries(proposed.worldVisuals || {})) if(value!==original.worldVisuals?.[key]) operations.push({op:'change_world_visual',target:key,value});
  }
  if (!operations.length) throw new Error('No supported scenario changes were found to review.');
  proposeApprovedEdit({schemaVersion:'world-edit.v1',summary:'Review proposed alternative before applying',operations,requiresSimulationRerun:true,warnings:[],provider:'user',model:'advanced-studio.v1',prompt:'Review proposed scenario input',baseRevision:getWorldRevisionId(input)});
}
async function enterFuture(run, {month = constructionMonth} = {}) {
  if (typeof run === 'string') run = state.results?.runs.find(row=>row.id===run);
  if (run?.experimentId && run.experimentId !== state.results?.experiment?.id) await reopenExperiment(run.experimentId,state.readonly);
  if (!run || !state.results?.runs.some(row=>row.id===run.id && row.seed===run.seed)) throw new Error('Select an actual stored future from this experiment.');
  await selectRun(run); if(state.selectedRun?.id!==run.id)return; constructionMonth = Number.isFinite(Number(month)) ? Number(month) : 0; stopConstructionPlayback(); syncConstructionWorld();
  document.body.classList.add('entered-future'); $('#future-entry-banner').hidden = false; $('#entered-future-name').textContent = `Inside ${run.id} · seed ${run.seed} · model ${run.modelVersion}`;
  const url=new URL(location.href);url.searchParams.set('run',run.id);url.searchParams.set('month',String(constructionMonth));url.hash='#physical-world';history.replaceState(null,'',url);
  $('#physical-world').scrollIntoView({behavior:'smooth',block:'start'}); updateAdvancedStudio();
}
$('#return-multiverse').addEventListener('click', () => { stopConstructionPlayback(); document.body.classList.remove('entered-future'); $('#future-entry-banner').hidden = true; const url=new URL(location.href);url.hash='#futures';history.replaceState(null,'',url); $('#futures').scrollIntoView({behavior:'smooth',block:'start'}); });

function projects() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } }
function refreshLocalProjects() {
  const select = $('#local-projects'); select.replaceChildren(el('option', 'Choose a local project…')); select.firstChild.value = '';
  for (const project of projects()) { const option = el('option', `${project.input.name} · ${new Date(project.savedAt).toLocaleDateString()}`); option.value = project.id; select.append(option); }
}
function saveProject(duplicate = false, silent = false) {
  if (state.readonly) return;
  if (duplicate) { state.projectId = null; $('#project-name').value = `${$('#project-name').value} copy`; }
  const input = currentInput(); const entries = projects(); const id = state.projectId || `project_${crypto.randomUUID().replaceAll('-', '')}`;
  const project = { id, savedAt: new Date().toISOString(), input }; const index = entries.findIndex(p => p.id === id);
  if (index >= 0) entries[index] = project; else entries.unshift(project);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0, 50))); state.projectId = id; refreshLocalProjects(); $('#local-projects').value = id;
  if (!silent) status(duplicate ? 'Editable project duplicated and saved in this browser.' : 'Project saved in this browser, including scenarios, uncertainty, and evidence metadata.');
}
async function refreshExperiments() {
  const payload = await client.list(); const select = $('#server-experiments'); const previous = select.value;
  select.replaceChildren(el('option', 'Choose an experiment…')); select.firstChild.value = '';
  for (const experiment of (payload.experiments || []).filter(item => !item.metadata?.preview || item.id === state.experiment?.id)) {
    const option = el('option', `${experiment.name} · ${experiment.status}${experiment.metadata?.preview ? ' · preview' : ''}`); option.value = experiment.id; select.append(option);
  }
  select.value = previous;
}
function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = el('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function hydrateVisibleRun(run) {
  const experimentId=state.results?.experiment?.id;
  if(!experimentId||!run?.id)return null;
  const token=++traceSelectionToken; state.tracePending=true;state.traceError=null;
  try {
    const full=await runTraces.get(experimentId,run.id);
    if(!full||token!==traceSelectionToken||state.results?.experiment?.id!==experimentId||constructionRun?.id!==run.id)return null;
    const latest=state.summaryResults;
    if(!latest||latest.experiment?.id!==experimentId)return null;
    // Merge into the most recent progressive envelope, never the snapshot that
    // happened to be current when this asynchronous trace request started.
    state.results={...latest,previousResults:state.previousResults,runs:latest.runs.map(row=>mergeRunTrace(row,runTraces.peek(experimentId,row.id)))};
    constructionRun=state.results.runs.find(row=>row.id===run.id)||null;
    if(state.selectedRun?.id===run.id)state.selectedRun=constructionRun;
    state.tracePending=false;
    visuals.update({...state.results,selectedRun:state.selectedRun||constructionRun});trust.update(state.results);syncConstructionWorld();updateAdvancedStudio();
    return constructionRun;
  } catch(error) {
    if(token===traceSelectionToken&&state.results?.experiment?.id===experimentId){state.traceError=`Trace loading failed: ${error.message}. Reselect this future to retry; its stored trace is unchanged.`;state.tracePending=false;syncConstructionWorld();}
    return null;
  }
}
async function selectRun(run) {
  if (typeof run === 'string') run=state.results?.runs.find(row=>row.id===run);
  if(!run?.id)return;
  const experimentId=state.results?.experiment?.id;
  automaticTraceKey=`${experimentId}/${run.id}`;
  constructionRun=run;state.selectedRun=run;state.selected=run.scenarioId;constructionMonth=0;stopConstructionPlayback();
  if(state.results)visuals.update({...state.results,previousResults:state.previousResults,selectedRun:run});
  renderScenarios();syncConstructionWorld();
  if(run.traceDelivery==='on-demand')run=await hydrateVisibleRun(run)||run;
  if(state.results?.experiment?.id!==experimentId||state.selectedRun?.id!==run.id)return;
  const box=$('#selected-run');box.hidden=false;box.replaceChildren();
  box.append(el('h3',`Future ${run.id}`),el('p',`Scenario: ${state.experiment?.scenarios?.find(s=>s.id===run.scenarioId)?.name||run.scenarioId} · Matched seed ${run.seed} · Model ${run.modelVersion||housingModel.version}`));
  if(run.traceDelivery==='on-demand')box.append(el('p',state.traceError||'The complete trace is stored and available on demand; it has not been loaded into this view.'));
  const details=el('details');details.append(el('summary','Inspect exact run inputs, events, and drivers'));
  details.append(el('pre',JSON.stringify({parameters:run.parameters,sampledParameters:run.sampledParameters,metrics:run.metrics,drivers:run.drivers,events:run.events},null,2)));box.append(details);
  const button=el('button',run.traceDelivery==='on-demand'?'Retry loading stored trace':'Download this complete run');
  button.addEventListener('click',()=>run.traceDelivery==='on-demand'?void selectRun(run):download(run,`hbl-${run.id}.json`));box.append(button);updateAdvancedStudio();
}

let upload = null;
function renderImportMapping(rows, filename) {
  upload = { rows, filename, mapping: {}, rowIndex: 0 }; const box = $('#import-mapping'); box.replaceChildren();
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  if (columns.length > 200 || rows.length > 10000) throw new Error('Use at most 200 columns and 10,000 rows for an interactive import.');
  const choiceLabel = el('label', 'PREVIEW / APPLY ROW'); const choice = el('select');
  rows.forEach((_, i) => { const o = el('option', `Row ${i + 1}`); o.value = String(i); choice.append(o); });
  choice.addEventListener('change', () => { upload.rowIndex = Number(choice.value); renderImportPreview(); }); choiceLabel.append(choice); box.append(choiceLabel);
  for (const column of columns) {
    const row = el('div', undefined, 'mapping-row'); row.append(el('span', column)); const select = el('select'); select.setAttribute('aria-label', `Map ${column} to parameter`);
    const skip = el('option', 'Skip column'); skip.value = ''; select.append(skip);
    for (const p of definitions) { const option = el('option', `${p.label} (${p.unit})`); option.value = p.id; select.append(option); }
    const match = definitions.find(p => p.id.toLowerCase() === column.toLowerCase() || p.label.toLowerCase() === column.toLowerCase());
    if (match) { select.value = match.id; upload.mapping[column] = match.id; }
    select.addEventListener('change', () => { upload.mapping[column] = select.value; renderImportPreview(); }); row.append(select); box.append(row);
  }
  renderImportPreview();
}
function mappedImport() {
  const values = {}, errors = [], row = upload?.rows[upload.rowIndex] || {};
  for (const [column, id] of Object.entries(upload?.mapping || {})) {
    if (!id) continue; const definition = definitions.find(p => p.id === id), raw = row[column];
    if (id in values) { errors.push(`${definition.label} is mapped more than once.`); continue; }
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw.replaceAll(',', '')) : NaN;
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) errors.push(`${column}: enter a number between ${definition.min} and ${definition.max} ${definition.unit}.`);
    else values[id] = value;
  }
  return { values, errors };
}
function renderImportPreview() {
  const box = $('#import-preview'); box.replaceChildren(); const { values, errors } = mappedImport();
  const table = el('table', undefined, 'import-table'); const head = el('tr'); head.append(el('th', 'Parameter'), el('th', 'Imported value')); table.append(head);
  for (const [id, value] of Object.entries(values)) { const row = el('tr'); const p = definitions.find(p => p.id === id); row.append(el('td', p.label), el('td', `${value} ${p.unit}`)); table.append(row); } box.append(table);
  for (const error of errors) box.append(el('p', error, 'compile-warning'));
  box.append(el('p', `${upload.rows.length} rows loaded; only selected row ${upload.rowIndex + 1} will be applied. Numeric values use native schema units (for example, fractions use 0.01 for 1%).`, 'fine'));
  $('#apply-import').disabled = state.readonly || errors.length > 0 || !Object.keys(values).length;
}
async function safe(action) { try { await action(); } catch (error) { status(error?.message || String(error), true); } }
const on = (id, action) => $(`#${id}`).addEventListener('click', () => safe(action));
on('try-example', useExample);
on('describe-decision', () => { $('#studio').scrollIntoView({ behavior: 'smooth' }); $('#decision-text').focus(); });
on('compile-plan', compilePlan);
on('run-experiment', () => runExperiment());
on('cancel-experiment', async () => { if (!state.experiment?.id || state.readonly) return; await client.cancel(state.experiment.id); status('Cancellation requested. Completed futures remain available.'); });
on('duplicate-scenario', () => {
  if (state.readonly) return; if (state.scenarios.length >= DECISION_LIMITS.maxScenarios) throw new Error('An experiment supports up to 8 alternatives.');
  const copy = clone(scenario()); copy.id = `alternative_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`; copy.name = `${copy.name} copy`; copy.kind = 'alternative'; state.scenarios.push(copy); state.selected = copy.id; renderScenarios(); markDirty();
});
$('#scenario-name').addEventListener('input', () => { if (state.readonly) return; scenario().name = $('#scenario-name').value; const tab = [...$('#scenario-tabs').children].find(n => n.dataset.scenarioId === state.selected); if (tab) tab.textContent = scenario().name; markDirty(); });
$('#decision-text').addEventListener('input', () => { state.needsCompile = true; });
for (const id of ['project-name', 'decision-text', 'run-years', 'run-seed']) $(`#${id}`).addEventListener('input', markDirty);
$('#run-count').addEventListener('change', updateRunDescription);
$('#auto-preview').addEventListener('change', () => { if (!$('#auto-preview').checked) clearTimeout(previewTimer); });
on('save-project', () => saveProject()); on('duplicate-project', () => saveProject(true));
on('open-local', () => {
  if (state.busy) throw new Error('Cancel the running experiment before opening another project.');
  const project = projects().find(p => p.id === $('#local-projects').value); if (!project) throw new Error('Choose a saved local project.');
  resetResults(); loadInput(project.input); state.projectId = project.id; setReadonly(false); status('Local project reopened. Run it to calculate fresh results.');
});
on('save-experiment', async () => { const result = await client.create(validateInput(currentInput())); state.experiment = result.experiment; state.preview = false; state.dirty = false; renderResults({experiment: result.experiment, runs: [], aggregates: [], comparisons: []}); await refreshExperiments(); $('#server-experiments').value = result.experiment.id; status('Experiment saved on the server. Reopen it or simulate when ready.'); });
on('refresh-experiments', refreshExperiments); on('open-server', () => reopenExperiment($('#server-experiments').value));
on('export-project', () => download(currentInput(), 'hbl-decision-project.json'));
on('download-manifest', async () => download(await client.manifest(state.experiment.id), `hbl-${state.experiment.id}-manifest.json`));
on('reproduce-experiment', async () => { const manifest = await client.manifest(state.experiment.id); const input = experimentInputFromManifest(manifest); resetResults(); loadInput(input); await runExperiment({ reproduction: input }); });
on('share-experiment', async () => { const url = new URL(location.href); url.search = ''; url.searchParams.set('experiment', state.experiment.id); url.searchParams.set('readonly', '1'); try { await navigator.clipboard.writeText(url.href); status('Read-only experiment link copied. Recipients can inspect the saved experiment and results.'); } catch { status(`Read-only link: ${url.href}`); } });
on('upgrade-model', () => { if (state.readonly) return; const previous = activeModel.version; activeModel = housingModel; state.metadata.modelUpgrade = { from: previous, to: housingModel.version, approvedAt: new Date().toISOString() }; $('#legacy-model-banner').hidden = true; markDirty(); renderScenarios(); status(`Editable draft upgraded from ${previous} to ${housingModel.version}. Stored results retain their original version; simulate to compare the new model.`); });
on('fork-shared', () => { setReadonly(false); state.projectId = null; $('#project-name').value += ' copy'; const url = new URL(location.href); url.searchParams.delete('readonly'); url.searchParams.delete('experiment'); history.replaceState(null, '', url); status('Editable copy ready. New simulations will create a separate experiment.'); });
function updateExecutiveSummary() {
  const input = state.results?.experiment || currentInput();
  $('#executive-question').textContent = input.decision || 'Describe a housing decision to begin.';
  $('#executive-options').textContent = `${input.scenarios.map(s => s.name).join('  /  ')} · ${input.runs} futures per scenario · ${input.years} years · ${housingModel.label}`;
}
on('executive-toggle', () => { const active = document.body.classList.toggle('executive-mode'); $('#executive-summary').hidden = !active; updateExecutiveSummary(); $('#executive-toggle').setAttribute('aria-pressed', String(active)); $('#executive-toggle').textContent = active ? 'Analyst mode' : 'Executive mode'; if (active) $('#studio').scrollIntoView({ behavior: 'smooth' }); });
$('#parameter-upload').addEventListener('change', () => safe(async () => {
  const file = $('#parameter-upload').files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) throw new Error('Use a CSV or JSON file smaller than 2 MB.');
  const parsed = parseParameterUpload(await file.text(), file.name);
  if (parsed.manifest) {
    if (state.busy) throw new Error('Cancel the running experiment before importing a project.');
    const input = experimentInputFromManifest(parsed.manifest); resetResults(); loadInput(input); setReadonly(false); state.projectId = null;
    status('Run manifest imported. Original parameters, seeds, uncertainty, and horizon restored. Click Simulate this plan to reproduce.');
  } else { renderImportMapping(parsed, file.name); status('Data loaded. Map columns, review the selected row, then apply inputs.'); }
}));
on('apply-import', () => {
  if (!upload || state.readonly) return; const { values, errors } = mappedImport(); if (errors.length) throw new Error(errors.join(' '));
  for (const [id,value] of Object.entries(values)) setDraftParameter(scenario(),id,value);
  state.evidence.push(...Object.entries(values).map(([parameterId, value]) => ({ id: `upload_${Date.now()}_${parameterId}`, parameterId, value, unit: definitions.find(p => p.id === parameterId).unit, type: 'user-upload', label: upload.filename, filename: upload.filename, source: `${upload.filename} · user supplied; accuracy unverified`, date: new Date().toISOString(), scenarioId: scenario().id, row: upload.rowIndex + 1, confidence: 'unverified', notes: 'Selected numerical row mapped into native model units; not an empirical calibration.' })));
  renderParameters(); markDirty(); status(`Applied ${Object.keys(values).length} inputs to ${scenario().name}. Original filename and mapping recorded in the evidence ledger.`);
});
function resetResults() {
  clearTimeout(previewTimer); stopConstructionPlayback(); constructionRun = null; constructionMonth = 0; worldPreview = null; worldVisualPreview = null; state.watch?.destroy(); activeRequest++; runTraces.clear();traceSelectionToken++;automaticTraceKey=null;state.summaryResults=null;state.tracePending=false;state.traceError=null; state.experiment = null; state.results = null; state.previousResults = null; state.selectedRun = null; state.hasRun = false; state.dirty = false; state.preview = false;
  const empty = { experiment: null, runs: [], aggregates: [], comparisons: [], model: housingModel, evidence: state.evidence };
  badges.update(empty); visuals.update(empty); trust.update(empty); diagnostics.update(empty); $('#selected-run').hidden = true;
  $('#share-experiment').disabled = $('#download-manifest').disabled = $('#reproduce-experiment').disabled = true;
  $('#result-context').textContent = 'Run the project to calculate its possible futures.';
  syncConstructionWorld(); updateAdvancedStudio();
  $('#run-progress').value = 0; $('#progress-count').textContent = '0 / 0'; $('#run-state').textContent = 'Ready to explore';
  const url = new URL(location.href); url.searchParams.delete('experiment'); url.searchParams.delete('readonly'); url.searchParams.delete('share'); history.replaceState(null, '', url);
}

// A compact debug surface for diagnostics and browser integration checks.
window.hblDecisionStudio = { state, currentInput, runExperiment, reopenExperiment, loadInput, worldTools, constructionView, advancedStudio, runTraces, enterFuture, proposeApprovedEdit };
renderScenarios(); refreshLocalProjects(); resetResults();
refreshExperiments().catch(error => status(`Experiment library unavailable: ${error.message}. Local editing and saving remain available.`, true));
async function initialize(params) {
  const id = params.get('experiment') || params.get('share') || localContextId(continuity.getContext()?.experimentId, 'experiment', 'decision');
  if (id) { await reopenExperiment(id, params.get('readonly') === '1' || Boolean(params.get('share'))); if (params.get('run') || continuity.getContext()?.runId) { const run=state.results?.runs.find(row=>row.id===(params.get('run') || localContextId(continuity.getContext()?.runId, 'run', 'decision'))); if(run) { selectRun(run); constructionMonth=Number(params.get('month'))||0;syncConstructionWorld(); if(location.hash!=='#futures')enterFuture(run,{month:constructionMonth}); } } }
  else if (params.get('demo') === '1') { useExample(); await runExperiment(); }
}

safe(() => initialize(initialQuery));
