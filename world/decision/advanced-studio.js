/** Advanced Studio host contract. All proposals go to the existing human approval
 * preview; this module never applies edits or invokes a separate simulator.
 * Context: {input,results,selectedRun,previousResults,readOnly,busy,stale?}.
 * Sibling mounts read live getters and receive progressive update(context).
 */
import { mountIntelligence } from './intelligence-view.js';
import { mountExploration } from './exploration.js';
import { mountRobustness } from './robustness.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
export function rankScenarioFutures({ results, scenarioId, metricId }) {
  const metric = results?.model?.metrics?.find(metric => metric.id === metricId);
  const direction = metric?.direction || metric?.better;
  const lower = direction === 'lower' || direction === 'lower-is-better' || metric?.higherIsBetter === false;
  const rows = (results?.runs || []).filter(run => run.scenarioId === scenarioId && ['completed', 'successful', 'succeeded'].includes(run.status) && finite(run.metrics?.[metricId]));
  const sorted = [...rows].sort((a, b) => (lower ? b.metrics[metricId] - a.metrics[metricId] : a.metrics[metricId] - b.metrics[metricId]) || String(a.id).localeCompare(String(b.id)));
  return { best: sorted.at(-1) || null, median: sorted[Math.floor((sorted.length - 1) / 2)] || null, worst: sorted[0] || null, count: sorted.length };
}
export function compareRunWithMedian(results, run) {
  if (!run) return [];
  return (results?.model?.metrics || []).flatMap(metric => {
    const values = (results.runs || []).filter(row => row.scenarioId === run.scenarioId && ['completed', 'successful', 'succeeded'].includes(row.status)).map(row => row.metrics?.[metric.id]).filter(finite).sort((a, b) => a - b);
    if (!values.length || !finite(run.metrics?.[metric.id])) return [];
    const middle = Math.floor(values.length / 2), median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    return [{ metricId: metric.id, label: metric.label, unit: metric.unit, value: run.metrics[metric.id], median, delta: run.metrics[metric.id] - median, count: values.length }];
  });
}
/** Keep explicit inherited overrides authoritative when a slider fixes a value. */
export function setDraftParameter(scenario, parameterId, value) {
  scenario.parameters ||= {}; scenario.uncertainty ||= {};
  scenario.parameters[parameterId] = value; delete scenario.uncertainty[parameterId];
  if (scenario.inheritsFrom) {
    scenario.overrides ||= {}; scenario.overrides.parameters ||= {}; scenario.overrides.uncertainty ||= {};
    scenario.overrides.parameters[parameterId] = value;
    scenario.overrides.uncertainty[parameterId] = {type:'fixed',value};
    scenario.uncertainty[parameterId] = {type:'fixed',value};
  }
}
export function setDraftUncertainty(scenario, parameterId, distribution) {
  scenario.uncertainty ||= {};
  if (distribution) scenario.uncertainty[parameterId] = structuredClone(distribution); else delete scenario.uncertainty[parameterId];
  if (scenario.inheritsFrom) { scenario.overrides ||= {}; scenario.overrides.uncertainty ||= {}; scenario.overrides.uncertainty[parameterId] = distribution ? structuredClone(distribution) : {type:'fixed',value:scenario.parameters[parameterId]}; }
}
/** Pure draft helpers used by the host. Current-policy baseline is undeletable. */
export function deleteDecisionScenario(input, scenarioId) {
  const current = input.scenarios.find(s => s.id === scenarioId);
  if (!current) throw new Error('Scenario not found.');
  if (current.kind === 'baseline') throw new Error('The current-policy baseline is protected. Duplicate it to explore another alternative.');
  return { ...structuredClone(input), scenarios: structuredClone(input.scenarios.filter(s => s.id !== scenarioId)) };
}
export function resetScenarioAssumptions(input, scenarioId, defaults) {
  const next = structuredClone(input), selected = next.scenarios.find(s => s.id === scenarioId);
  if (!selected) throw new Error('Scenario not found.');
  const original = defaults.find(s => s.kind === selected.kind) || defaults.find(s => s.kind === 'baseline');
  if (!original) throw new Error('No model defaults are available.');
  for (const key of ['parameters', 'uncertainty', 'stressPresets', 'scheduledStress']) {
    if (original[key] === undefined) delete selected[key]; else selected[key] = structuredClone(original[key]);
  }
  delete selected.inheritsFrom; delete selected.overrides;
  return next;
}
export function configuredUncertaintyCurve(definition, distribution, value, count = 41) {
  const min = distribution?.min ?? definition.min, max = distribution?.max ?? definition.max;
  const type = distribution?.type || 'fixed';
  if (type === 'fixed' || max <= min) return { type: 'fixed', min: value, max: value, points: [] };
  let points = Array.from({length: count}, (_, i) => {
    const x = i / (count - 1), actual = min + x * (max - min);
    if (type === 'uniform') return [x, 1];
    if (type === 'triangular') { const mode = distribution.mode ?? value; if(mode<=min)return[x,1-x];if(mode>=max)return[x,x]; return [x, actual <= mode ? (actual - min) / (mode - min || 1e-12) : (max - actual) / (max - mode || 1e-12)]; }
    const mean = distribution.mean ?? value, stddev = distribution.stddev || (max - min) / 6;
    return [x, Math.exp(-.5 * ((actual - mean) / stddev) ** 2)];
  });
  const peak = Math.max(...points.map(p => p[1]), 1e-12); points = points.map(([x,y]) => [x, Math.max(0,y / peak)]);
  return { type, min, max, points };
}
export function mountAdvancedStudio(container, { getInput, getResults, getSelectedRun, onProposeEdit, onApplyInput, onSelectRun, onEnterFuture, onRunExperiment } = {}) {
  if (!container?.ownerDocument) throw new TypeError('Advanced studio requires a DOM container.');
  const doc = container.ownerDocument, root = doc.createElement('section'); root.className = 'advanced-studio';
  root.innerHTML = `<header class="as-header"><div><p class="as-eyebrow">FROM A WEAK FUTURE TO A BETTER PLAN</p><h2>Find the failure. Test the fix.</h2><p>Explore the evidence, propose a change, approve it, and compare the new futures with the old.</p></div><span class="as-mode">Exploratory model · matched seeds</span></header><p class="as-status" data-as-status role="status" aria-live="polite">Run an experiment to begin.</p>
    <section class="as-future-bar" aria-label="Future shortcuts"><div><strong>Enter a real simulated future</strong><p data-as-selected>No future selected.</p></div><label>Rank by<select data-as-metric aria-label="Future shortcut metric"></select></label><div class="as-actions"><button data-as-pick="best">Best</button><button data-as-pick="median">Median</button><button data-as-pick="worst">Worst</button><button data-as-enter>Enter selected future ↗</button></div></section>
    <details class="as-median"><summary>Compare selected future with its scenario median</summary><div data-as-median></div></details>
    <nav class="as-tabs" aria-label="Advanced decision tools"><button data-as-tab="intelligence" aria-pressed="true">Failure → test fix</button><button data-as-tab="exploration" aria-pressed="false">Explain, fork & optimize</button><button data-as-tab="robustness" aria-pressed="false">Stress & robustness</button></nav>
    <section data-as-pane="intelligence"></section><section data-as-pane="exploration" hidden></section><section data-as-pane="robustness" hidden></section>`;
  container.append(root); const find = selector => root.querySelector(selector);
  let context = {}, destroyed = false, metricId = 'affordability';
  const announce = message => { find('[data-as-status]').textContent = message; };
  const propose = proposal => { if (context.readOnly || context.busy) { announce(context.readOnly ? 'Make an editable copy before proposing changes.' : 'Wait for the current experiment, or cancel it before proposing a fix.'); return; } return onProposeEdit?.(proposal); };
  const apply = (...args) => { if (context.readOnly || context.busy) { announce('Open an editable, idle project to review this change.'); return; } return onApplyInput?.(...args); };
  const currentInput = () => getInput?.() || context.input;
  const currentResults = () => getResults?.() || context.results;
  const currentRun = () => getSelectedRun?.() || context.selectedRun;
  const intelligence = mountIntelligence(find('[data-as-pane="intelligence"]'), { onProposeEdit: propose, onSelectRun: run => onSelectRun?.(run) });
  const exploration = mountExploration(find('[data-as-pane="exploration"]'), { getInput: currentInput, getResults: currentResults, getSelectedRun: currentRun, onApplyInput: apply, onProposeEdit: propose, onSelectRun, onEnterFuture });
  const robustness = mountRobustness(find('[data-as-pane="robustness"]'), { getInput: currentInput, onApplyInput: apply, onProposeEdit: propose });
  const format = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
  function renderShortcuts() {
    const results = currentResults(), input = currentInput(), selected = currentRun();
    const scenarioId = selected?.scenarioId || input?.scenarios?.find(s => s.kind === 'plan-a')?.id || input?.scenarios?.[0]?.id;
    const metrics = results?.model?.metrics || [];
    if (!metrics.some(metric => metric.id === metricId)) metricId = metrics.find(m => m.id === 'affordability')?.id || metrics[0]?.id || '';
    const select = find('[data-as-metric]'); select.replaceChildren();
    for (const metric of metrics) { const option = doc.createElement('option'); option.value = metric.id; option.textContent = metric.label || metric.id; select.append(option); } select.value = metricId;
    const ranked = rankScenarioFutures({ results, scenarioId, metricId });
    for (const button of root.querySelectorAll('[data-as-pick]')) button.disabled = !ranked.count;
    find('[data-as-enter]').disabled = !selected;
    find('[data-as-selected]').textContent = selected ? `${results?.experiment?.scenarios?.find(s => s.id === selected.scenarioId)?.name || selected.scenarioId} · ${selected.id} · seed ${selected.seed}` : `${ranked.count} recorded futures available in this scenario. Choose best, median, worst, or select a point.`;
    const box = find('[data-as-median]'); box.replaceChildren();
    const comparisons = compareRunWithMedian(results, selected);
    if (!comparisons.length) { box.textContent = 'Select a stored future to compare observed final metrics with its scenario distribution.'; return; }
    const table = doc.createElement('table'); const head = doc.createElement('tr'); for (const label of ['Metric', 'Selected future', 'Scenario median', 'Difference']) { const th = doc.createElement('th'); th.textContent = label; head.append(th); } table.append(head);
    for (const row of comparisons) { const tr = doc.createElement('tr'); for (const value of [`${row.label} (${row.unit})`, format(row.value), format(row.median), `${row.delta > 0 ? '+' : ''}${format(row.delta)}`]) { const td = doc.createElement('td'); td.textContent = value; tr.append(td); } table.append(tr); } box.append(table);
  }
  function update(next = {}) {
    if (destroyed) return; context = next;
    announce(next.stale ? 'Inputs changed. Analysis below describes the stored experiment; approve and run a revision to update results.' : next.busy ? 'Experiment running. Partial results are provisional; analysis updates as actual futures arrive.' : next.readOnly ? 'Read-only results. Explore and enter futures; copy the project to propose edits.' : next.results?.runs?.length ? 'Select a failure pattern, review a proposed fix, and compare the rerun with the previous cloud.' : 'Run an experiment to begin the failure → fix → compare loop.');
    intelligence.update(next); exploration.update(next); robustness.update(next); renderShortcuts();
  }
  const click = event => {
    const tab = event.target.closest('[data-as-tab]');
    if (tab) { for (const pane of root.querySelectorAll('[data-as-pane]')) pane.hidden = pane.dataset.asPane !== tab.dataset.asTab; for (const b of root.querySelectorAll('[data-as-tab]')) b.setAttribute('aria-pressed', String(b === tab)); }
    const pick = event.target.closest('[data-as-pick]'); if (pick && !pick.disabled) { const selected = currentRun(), input = currentInput(); const ranked = rankScenarioFutures({ results: currentResults(), scenarioId: selected?.scenarioId || input?.scenarios?.find(s => s.kind === 'plan-a')?.id || input?.scenarios?.[0]?.id, metricId }); const run = ranked[pick.dataset.asPick]; if (run) onSelectRun?.(run); }
    if (event.target.closest('[data-as-enter]') && currentRun()) onEnterFuture?.(currentRun());
  };
  const change = event => { if (event.target.matches('[data-as-metric]')) { metricId = event.target.value; renderShortcuts(); } };
  root.addEventListener('click', click); root.addEventListener('change', change); update();
  return { update, destroy() { if (destroyed) return; destroyed = true; intelligence.destroy(); exploration.destroy(); robustness.destroy(); root.removeEventListener('click', click); root.removeEventListener('change', change); root.remove(); } };
}
