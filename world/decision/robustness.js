/** ROBUSTNESS UI CONTRACT for advanced-studio.js:
 * mountRobustness(container,{getInput,onApplyInput,onProposeEdit}) ->
 * {update({input,results,selectedRun,readOnly,busy}),destroy()}.
 * Runs separate immutable experiments using createDecisionClient, sequentially
 * per stress with identical source seed/runs/horizon. Never applies source edits.
 * A matrix is a diagnostic preview; only onProposeEdit opens an approval flow.
 * update does not overwrite in-progress/finished matrix snapshots. No hardcoded
 * outcomes, no provider calls. Engine job API is not required: same normal runner.
 */
import { housingModel, stressPresets, resolveHousingModel } from '../models/housing/index.js';
import { createDecisionClient } from './client.js';
import { DECISION_LIMITS, classifyDecisionOutcome, normalizeDecisionInput } from './contracts.js';
import { recordLocalDemoEvent } from './onboarding.js';
import { getWorldRevisionId, fingerprintWorldInput } from '../ai/edit-schema.js';

export const ROBUSTNESS_LIMITS = Object.freeze({ maxPlans: 4, maxStresses: 8, maxTotalRuns: 1600, maxRunsPerCell: 50 });
export function buildRobustnessExperiment({ input, planIds, stressId = 'control', runs = 10, criterion }) {
  if (!input?.scenarios?.length) throw new Error('Load a decision before stress testing.');
  const normalized = normalizeDecisionInput(input, resolveHousingModel(input.modelVersion).model);
  const baseline = normalized.scenarios.find(scenario => scenario.kind === 'baseline');
  if (!baseline) throw new Error('Stress testing requires a current-policy baseline.');
  const ids = [...new Set([baseline.id, ...planIds])];
  if (ids.length > ROBUSTNESS_LIMITS.maxPlans) throw new Error('Compare at most four plans including current policy.');
  if (!Number.isInteger(runs) || runs < 1 || runs > ROBUSTNESS_LIMITS.maxRunsPerCell) throw new Error('Choose 1–50 futures per cell.');
  if (stressId !== 'control' && !stressPresets.some(preset => preset.id === stressId)) throw new Error('Select a known stress preset.');
  if (!housingModel.metrics.some(metric => metric.id === criterion?.metricId) || !['gte','lte'].includes(criterion?.operator) || !Number.isFinite(criterion?.value)) throw new Error('Choose a finite, explicit success criterion.');
  const scenarios = ids.map(id => {
    const original = normalized.scenarios.find(scenario => scenario.id === id);
    if (!original) throw new Error(`Plan ${id} is no longer available.`);
    const materialized = structuredClone(original); delete materialized.inheritsFrom; delete materialized.overrides; delete materialized.outcomeCriteria;
    return { ...materialized, successCriterion: { ...criterion }, stressPresets: [...new Set([...(original.stressPresets || []), ...(stressId === 'control' ? [] : [stressId])])] };
  });
  const yearly = runs * scenarios.length * (input.years + 1);
  const states = runs * scenarios.reduce((sum, scenario) => sum + (scenario.projects?.length || 0), 0) * (input.years * 12 + 1);
  if (yearly > DECISION_LIMITS.maxTimelinePoints || states > DECISION_LIMITS.maxProjectStates) throw new Error('This matrix cell exceeds the runner timeline/project-state budget. Reduce runs, years, plans or projects.');
  return { schemaVersion: input.schemaVersion, name: `${input.name.slice(0,120)} · robustness · ${stressId}`, decision: input.decision, modelId: input.modelId, modelVersion: input.modelVersion, seed: input.seed, years: input.years, runs, scenarios,
    metadata: { ...structuredClone(input.metadata || {}), preview: true, robustness: { schemaVersion: 'robustness-matrix.v1', sourceFingerprint: fingerprintWorldInput(input), stressId, criterion: { ...criterion }, sourceRevision: getWorldRevisionId(input) } } };
}
export function summarizeRobustnessCell({ result, scenarioId, criterion }) {
  const rows = (result?.runs || []).filter(row => row.scenarioId === scenarioId);
  const eligible = rows.filter(row => row.status === 'completed' && !row.error && Number.isFinite(row.metrics?.[criterion.metricId]));
  const success = eligible.filter(row => classifyDecisionOutcome(row.metrics, {successCriterion:criterion}) === 'success').length;
  const failed = rows.filter(row => row.status === 'failed' || row.error).length;
  return { scenarioId, success, eligible: eligible.length, failed, missing: rows.length - eligible.length - failed, attempted: rows.length, share: eligible.length ? success / eligible.length : null, experimentId: result?.experiment?.id, status: result?.experiment?.status || 'pending' };
}
export function scoreRobustness(cells) {
  const eligible = cells.reduce((sum, cell) => sum + cell.eligible, 0), success = cells.reduce((sum, cell) => sum + cell.success, 0);
  const ranked = cells.filter(cell => cell.share !== null).sort((a,b) => a.share - b.share);
  return { eligible, success, share: eligible ? success / eligible : null, worst: ranked[0] || null, failed: cells.reduce((sum, cell) => sum + cell.failed, 0) };
}

export function mountRobustness(container, { getInput, onApplyInput: _onApplyInput, onProposeEdit, client = createDecisionClient() } = {}) {
  if (!container?.ownerDocument || typeof getInput !== 'function') throw new TypeError('Robustness requires a container and getInput().');
  const doc = container.ownerDocument, root = doc.createElement('section'); root.className = 'decision-robustness'; root.dataset.testid = 'robustness';
  const stylesheet = doc.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = new URL('./robustness.css', import.meta.url).href;
  root.innerHTML = `<header><p class="rb-eyebrow">TEST THE REMAINING VULNERABILITIES</p><h2>Plan × stress matrix</h2><p>Actual paired model runs. Same seed sequence and horizon across every cell; stress presets compose with each plan’s existing assumptions.</p></header><div class="rb-controls"><fieldset data-rb-plans><legend>Plans · current policy always included</legend></fieldset><fieldset data-rb-stresses><legend>Stress sequence</legend></fieldset><div class="rb-criterion"><label>Success metric<select data-rb-metric aria-label="Robustness success metric"></select></label><label>Rule<select data-rb-operator aria-label="Robustness comparison"><option value="gte">at least ≥</option><option value="lte">at most ≤</option></select></label><label>Threshold<input data-rb-threshold aria-label="Robustness threshold" type="number" step="any" value="60"></label><label>Futures per cell<select data-rb-runs aria-label="Robustness futures per cell"><option>10</option><option>25</option><option>50</option></select></label></div><p class="rb-note" data-rb-criterion-note>Example threshold, not a forecast or recommendation. Review it in the metric’s native units.</p><div class="rb-actions"><button data-rb-start>Run stress sequence</button><button data-rb-cancel disabled>Cancel stress sequence</button></div></div><p class="rb-status" role="status" aria-live="polite" data-rb-status>No matrix run. Choose plans, stresses and a success threshold.</p><progress data-rb-progress max="1" value="0" aria-label="Stress sequence progress"></progress><div data-rb-result></div><p class="rb-note">Score = completed simulations meeting the criterion / all completed simulations with the selected metric. Failed or missing-metric rows are reported separately, not silently counted as success. Repeated control worlds across stresses are matched comparisons, not independent empirical observations.</p>`;
  root.prepend(stylesheet); container.append(root);
  const $ = selector => root.querySelector(selector), element = (tag, text) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = String(text); return node; };
  let context = {}, source = null, planList = [], stressList = [], cells = new Map(), running = false, cancelled = false, destroyed = false, watcher = null, activeId = null, finishWait = null, generation = 0, signature = '', lastStatus = '';
  function currentSourceInput() {
    const draft=getInput(), recorded=context.results?.experiment;
    // A 10-run approved preview can leave the run-selector at 100. When all
    // other recorded inputs match, bind analysis to the actual experiment,
    // not to that unexecuted run-count setting. Real edits remain stale.
    if(recorded&&!context.stale&&fingerprintWorldInput({...draft,runs:1})===fingerprintWorldInput({...recorded,runs:1}))return recorded;
    return draft;
  }
  let storage; try { storage = doc.defaultView?.localStorage; } catch {}
  const reportKey = input => `hbl.robustness.v1:${fingerprintWorldInput(input)}:${getWorldRevisionId(input)}`;
  function getReport() {
    if (!source) return null;
    return { schemaVersion: 'robustness-report.v1', stale: fingerprintWorldInput(currentSourceInput()) !== source.fingerprint || getWorldRevisionId(currentSourceInput()) !== getWorldRevisionId(source.input), sourceFingerprint: source.fingerprint, sourceRevision: getWorldRevisionId(source.input), modelId: source.input.modelId, modelVersion: source.input.modelVersion, seed: source.input.seed, years: source.input.years, criterion: {...source.criterion}, plans: planList.map(({id,name,kind})=>({id,name,kind})), stresses: structuredClone(stressList), cells: [...cells].map(([key,cell]) => ({key,...cell})), status: running ? 'running' : cancelled ? 'cancelled' : 'completed', createdAt: source.createdAt, updatedAt: new Date().toISOString(), retention: 'Cell experiments are bounded preview records; links expire when evicted from the latest 20 previews. Saved summaries retain original denominators and are not a fresh run.' };
  }
  function persistReport() { const report = getReport(); if (!report) return; try { storage?.setItem(reportKey(source.input), JSON.stringify(report)); } catch {} root.dispatchEvent(new doc.defaultView.CustomEvent('decision:robustness-report',{bubbles:true,detail:report})); }
  function restoreReport(input) {
    if (source || !input?.scenarios) return;
    try { const report = JSON.parse(storage?.getItem(reportKey(input)) || 'null'); if (!report || report.sourceFingerprint !== fingerprintWorldInput(input) || report.modelVersion !== input.modelVersion || report.sourceRevision !== getWorldRevisionId(input)) return; source = { input: structuredClone(input), criterion: report.criterion, fingerprint: report.sourceFingerprint, createdAt: report.createdAt }; planList = report.plans; stressList = report.stresses; cells = new Map(report.cells.map(({key,...cell}) => [key,{...cell,availability:'unverified'}])); cancelled = report.status !== 'completed'; announce('Saved matrix restored for these exact inputs. Verifying preview-record links; summaries are not fresh simulations.'); render(); persistReport(); const ids=[...new Set(report.cells.map(cell=>cell.experimentId).filter(Boolean))]; for (const id of ids) client.get(id).then(()=>{for(const cell of cells.values())if(cell.experimentId===id)cell.availability='available';render();persistReport()}).catch(()=>{for(const cell of cells.values())if(cell.experimentId===id)cell.availability='expired';render();persistReport()}); } catch {}
  }
  const listeners = []; const listen = (node,event,fn) => { node.addEventListener(event,fn); listeners.push(() => node.removeEventListener(event,fn)); };
  function announce(message) { lastStatus = message; if (!destroyed) $('[data-rb-status]').textContent = message; }
  function controls() {
    const metric = $('[data-rb-metric]').value, operator = $('[data-rb-operator]').value, raw = $('[data-rb-threshold]').value;
    if (!raw.trim() || !Number.isFinite(Number(raw))) throw new Error('Enter a finite success threshold.');
    return { metricId: metric, operator, value: Number(raw) };
  }
  const percent = value => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  function render() {
    if (destroyed) return;
    const output = $('[data-rb-result]'); output.replaceChildren();
    if (!source || !planList.length) return;
    const criterion = source.criterion, meta = housingModel.metrics.find(metric => metric.id === criterion.metricId);
    output.append(element('p', `Snapshot seed ${source.input.seed} · model ${source.input.modelVersion} · ${source.input.years} years · success: ${meta?.label || criterion.metricId} ${criterion.operator === 'gte' ? '≥' : '≤'} ${criterion.value} ${meta?.unit || ''}. ${fingerprintWorldInput(currentSourceInput()) !== source.fingerprint || getWorldRevisionId(currentSourceInput()) !== getWorldRevisionId(source.input) ? 'Source inputs changed; this matrix still describes the captured input.' : ''}`));
    const scroll = element('div'); scroll.className = 'rb-table-wrap'; const table = element('table'), head = element('tr'); head.append(element('th','Plan'));
    for (const stress of stressList) head.append(element('th', stress.label)); head.append(element('th','Score / vulnerability')); table.append(head);
    for (const plan of planList) {
      const row = element('tr'); row.append(element('th', plan.name));
      const completedCells = [];
      for (const stress of stressList) {
        const cell = cells.get(`${plan.id}:${stress.id}`), td = element('td');
        if (!cell) td.textContent = cancelled ? 'Not run · cancelled' : 'Pending';
        else {
          completedCells.push({ ...cell, stressId: stress.id, stressLabel: stress.label });
          td.append(element('strong', percent(cell.share)), element('small', `${cell.success} / ${cell.eligible} eligible · ${cell.failed} failed · ${cell.missing} missing`));
          if (cell.status !== 'completed') td.append(element('small', `${cell.status} · provisional`));
          if (cell.availability === 'expired') td.append(element('small','Saved summary · preview record expired'));
          else if (cell.experimentId) { const link = element('a','Inspect exact experiment'); link.href = `/world/decision.html?experiment=${encodeURIComponent(cell.experimentId)}`; link.target = '_blank'; link.rel = 'noopener'; td.append(link); }
        }
        row.append(td);
      }
      const score = scoreRobustness(completedCells), summary = element('td'); summary.append(element('strong', percent(score.share)), element('small', `${score.success} / ${score.eligible} eligible across ${completedCells.length}/${stressList.length} stresses; ${score.failed} failed`));
      if (score.worst) summary.append(element('small', `Weakest observed: ${score.worst.stressLabel} (${percent(score.worst.share)}). Describes this chosen grid only.`));
      row.append(summary); table.append(row);
    }
    scroll.append(table); output.append(scroll);
    output.append(element('p', running ? 'Sequence running. Partial scores remain provisional.' : cancelled ? 'Sequence cancelled. Completed cells remain inspectable; unrun cells are not scored.' : 'Sequence finished. No source scenario was changed. Inspect weaknesses before proposing a revision.'));
  }
  function fillOptions() {
    const input = getInput(); if (!input?.scenarios) return;
    const nextSignature = input.scenarios.map(s => `${s.id}:${s.name}`).join('|');
    if (signature === nextSignature) return; signature = nextSignature;
    const box = $('[data-rb-plans]'); box.replaceChildren(element('legend','Plans · current policy always included'));
    for (const plan of input.scenarios) {
      const label = element('label'), checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.value = plan.id; checkbox.dataset.rbPlan = plan.id;
      checkbox.checked = plan.kind === 'baseline' || ['plan-a','plan-b'].includes(plan.kind); checkbox.disabled = plan.kind === 'baseline'; label.append(checkbox, doc.createTextNode(plan.name)); box.append(label);
    }
  }
  function setBusy() { for (const node of root.querySelectorAll('.rb-controls input,.rb-controls select,.rb-controls button')) node.disabled = running || Boolean(context.busy) || Boolean(context.readOnly); $('[data-rb-cancel]').disabled = !running; for (const checkbox of root.querySelectorAll('[data-rb-plan]')) if (getInput()?.scenarios?.find(s => s.id === checkbox.value)?.kind === 'baseline') checkbox.disabled = true; }
  async function stop() {
    cancelled = true;
    if (activeId) try { await client.cancel(activeId); } catch (error) { announce(`Cancellation requested; server response failed: ${error.message}`); }
    watcher?.destroy(); watcher = null; finishWait?.(); finishWait = null;
    render();
  }
  async function run() {
    if (running || context.busy || context.readOnly) return;
    const input = structuredClone(currentSourceInput()), criterion = controls(), runs = Number($('[data-rb-runs]').value);
    const plans = [...root.querySelectorAll('[data-rb-plan]:checked')].map(node => node.value), stresses = [...root.querySelectorAll('[data-rb-stress]:checked')].map(node => node.value);
    if (!stresses.length || stresses.length > ROBUSTNESS_LIMITS.maxStresses) throw new Error('Choose 1–8 stress cases.');
    const batches = stresses.map(stressId => buildRobustnessExperiment({ input, planIds: plans, stressId, runs, criterion }));
    if (batches.reduce((sum,batch) => sum + batch.runs * batch.scenarios.length,0) > ROBUSTNESS_LIMITS.maxTotalRuns) throw new Error('Matrix budget exceeds 1,600 total futures.');
    source = { input, criterion, fingerprint: fingerprintWorldInput(input), createdAt: new Date().toISOString() }; planList = batches[0].scenarios; stressList = stresses.map(id => ({ id, label: id === 'control' ? 'No added stress' : stressPresets.find(p => p.id === id)?.label || id })); cells = new Map(); running = true; cancelled = false; recordLocalDemoEvent('stress-sequence-started',{runs,scenarioCount:planList.length,modelVersion:input.modelVersion},doc.defaultView); const token = ++generation; setBusy();
    const total = batches.reduce((sum,batch) => sum + batch.runs * batch.scenarios.length,0); $('[data-rb-progress]').max = total; let completed = 0;
    try {
      for (let index = 0; index < batches.length; index++) {
        if (cancelled || destroyed || token !== generation) break;
        const batch = batches[index], stress = stressList[index]; announce(`Stress ${index + 1}/${batches.length}: ${stress.label} · ${completed}/${total} futures processed.`); render();
        const created = await client.create(batch); activeId = created.experiment.id;
        if (cancelled || destroyed) { await client.cancel(activeId); break; }
        await client.start(activeId);
        if (cancelled || destroyed) { await client.cancel(activeId); break; }
        let batchProcessed = 0;
        await new Promise((resolve,reject) => {
          finishWait = resolve;
          watcher = client.watch(activeId, { onUpdate(result) {
            if (destroyed || token !== generation) return;
            for (const plan of planList) cells.set(`${plan.id}:${stress.id}`, summarizeRobustnessCell({ result, scenarioId: plan.id, criterion }));
            batchProcessed = result.experiment.progress?.completed || result.runs?.length || 0; $('[data-rb-progress]').value = completed + batchProcessed; render();
            const status = result.experiment.status;
            if (['completed','cancelled','failed'].includes(status)) { if (status === 'failed') announce(`Stress ${stress.label} failed: ${result.experiment.error || 'runner failure'}`); if (status === 'cancelled') cancelled = true; resolve(); }
          }, onError: reject });
        });
        watcher?.destroy(); watcher = null; finishWait = null; activeId = null; completed += batchProcessed;
      }
      if (!destroyed) announce(cancelled ? 'Stress sequence cancelled. Only actual completed cells are scored.' : `Stress sequence complete · ${completed}/${total} requested futures processed. Inspect exact experiments and remaining vulnerabilities.`);
    } catch (error) { cancelled = true; if(activeId) await client.cancel(activeId).catch(()=>{}); announce(`Stress sequence stopped: ${error.message}. Existing cells remain available.`); }
    finally { activeId = null; running = false; setBusy(); render(); persistReport(); if(!cancelled)recordLocalDemoEvent('stress-sequence-completed',{runs:completed,scenarioCount:planList.length,modelVersion:input.modelVersion},doc.defaultView); }
  }
  const metricSelect = $('[data-rb-metric]');
  for (const metric of housingModel.metrics) { const option = element('option', `${metric.label} (${metric.unit})`); option.value = metric.id; metricSelect.append(option); }
  metricSelect.value = housingModel.metrics.some(metric => metric.id === 'affordability') ? 'affordability' : housingModel.metrics[0]?.id;
  for (const stress of [{id:'control',label:'No added stress'}, ...stressPresets]) { const label = element('label'), checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.value = stress.id; checkbox.dataset.rbStress = stress.id; checkbox.checked = ['control','recession','high-inflation','supply-constraint'].includes(stress.id); label.append(checkbox,doc.createTextNode(stress.label || stress.name)); $('[data-rb-stresses]').append(label); }
  listen($('[data-rb-start]'),'click',() => { run().catch(error => announce(error.message)); }); listen($('[data-rb-cancel]'),'click',() => { void stop(); });
  // Deliberately no "apply results" button: stress diagnostics are not approval.
  return { update(next = {}) { context = next; if (!running) { fillOptions(); restoreReport(currentSourceInput()); } setBusy(); if (source) render(); }, getReport, destroy() { persistReport(); destroyed = true; generation++; cancelled = true; watcher?.destroy(); finishWait?.(); if (activeId) void client.cancel(activeId).catch(() => {}); for (const off of listeners) off(); root.remove(); } };
}
