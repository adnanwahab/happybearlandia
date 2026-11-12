import { recordContext } from './decision/continuity.js';
import { mountContinuity } from './decision/continuity-view.js';
import { createInspectorState, formatVariableValue, renderAssumptionInspector } from "./assumption-inspector.js";
import { generateWorlds } from "./world-generator.js";
import { resolveSimulationAdapter, simulateExperiment } from "./simulation-adapter.js";
import { attachOutcomeAnalysis, summarizeOutcomes } from "./outcome-analysis.js";
import { scenarioTargetingAnalysis, summarizeScenarioFamilies } from "./scenario-outcome-analysis.js";
import { projectOutcomeLandscape, renderOutcomeLandscape } from "./outcome-landscape.js";
import { renderRealityInspector } from "./reality-inspector.js";
import { analyzeSensitivity } from "./sensitivity-analysis.js";
import { applyPlanImprovement, generatePlanImprovements } from "./plan-improver.js";
import { resolveCivicExperimentPayload } from "./experiment-contract.js";
import { formatVerificationReport, runExperimentVerification } from "./experiment-verification.js";
import { createExperimentRecord, summarizeExperimentRecord, traceRecordLineage } from "./experiment-record.js";
import { listExperimentRecords, loadExperimentRecord, saveExperimentRecord } from "./experiment-store.js";
import { buildDearCongressRevisionDraft, postDearCongressRevisionDraft } from "./dear-congress-feedback.js";
import { buildPensieveHandoff, buildPensieveLaunchUrl, downloadPensieveHandoff, serializePensieveHandoff } from "./pensieve-handoff.js";
import { applyPlanParameterPatch, compilePlanParameterPatch } from "./plan-parameter-patch.js";

import { runLiveSimulation } from "./live-simulation.js";
import { mountLiveParameterControls } from "./live-parameter-controls.js";
import { mountLiveTimelineView } from "./live-timeline-view.js";

const continuity = mountContinuity();
const state = {
  experiment: null,
  liveResult: null,
  inspector: null,
  overrides: {},
  parameterPatch: null,
  worldBatch: null,
  simulationBatch: null,
  analyzedExperiment: null,
  sensitivity: null,
  improvements: [],
  recordId: null,
  parentRecordId: null,
  improvementComparison: null,
  scenarioComparison: null,
  revisionDraft: null,
};

const $ = (selector) => document.querySelector(selector);
const status = $("#status");
const input = $("#json-input");
const assumptions = $("#assumptions");
const summary = $("#plan-summary");
const metricRegistry = $("#metric-registry");
const overrideOutput = $("#override-output");
const previewPlanParameterPatchButton = $("#preview-plan-parameter-patch");
const applyPlanParameterPatchButton = $("#apply-plan-parameter-patch");
const planParameterPatchSummary = $("#plan-parameter-patch-summary");
const planParameterPatchPreview = $("#plan-parameter-patch-preview");
const generateWorldsButton = $("#generate-worlds");
const worldSummary = $("#world-summary");
const worldPreview = $("#world-preview");
const runSimulationsButton = $("#run-simulations");
const simulationSummary = $("#simulation-summary");
const simulationPreview = $("#simulation-preview");
const outcomeSummary = $("#outcome-summary");
const scenarioFamilySummary = $("#scenario-family-summary");
const scenarioFamilyComparison = $("#scenario-family-comparison");
const scenarioFamilyDiagnosis = $("#scenario-family-diagnosis");
const scenarioTargetSelect = $("#scenario-target");
const targetScenarioImprovementsButton = $("#target-scenario-improvements");
const scenarioTargetStatus = $("#scenario-target-status");
const tailPreview = $("#tail-preview");
const landscapeSvg = $("#outcome-landscape");
const landscapeSelection = $("#landscape-selection");
const realityInspector = $("#reality-inspector");
const sensitivityOutput = $("#sensitivity-output");
const improvementOutput = $("#improvement-output");
const improvementResult = $("#improvement-result");
const runVerificationButton = $("#run-verification");
const verificationOutput = $("#verification-output");
const saveExperimentButton = $("#save-experiment");
const loadLatestExperimentButton = $("#load-latest-experiment");
const copyExperimentLinkButton = $("#copy-experiment-link");
const recordStatus = $("#record-status");
const lineageOutput = $("#lineage-output");
const prepareRevisionButton = $("#prepare-revision");
const sendRevisionButton = $("#send-revision");
const revisionStatus = $("#revision-status");
const revisionPreview = $("#revision-preview");
const pensieveUrlInput = $("#pensieve-url");
const copyPensieveHandoffButton = $("#copy-pensieve-handoff");
const downloadPensieveHandoffButton = $("#download-pensieve-handoff");
const openPensieveButton = $("#open-pensieve");
const pensieveStatus = $("#pensieve-status");

const liveStatus = $("#live-status");
const liveTimelineContainer = $("#live-timeline");
liveTimelineContainer.replaceChildren();
const liveView = mountLiveTimelineView(liveTimelineContainer);
let liveControls = null;
let liveTimer = null;
let liveRequest = 0;

function renderLabAssumptions(experiment, initialOverrides = {}) {
  const variables = experiment.worldModel?.variables || [];
  const inspectorState = createInspectorState(variables);
  for (const [id, override] of Object.entries(initialOverrides || {})) {
    if (!inspectorState[id]) continue;
    inspectorState[id] = {
      baseline: Number.isFinite(Number(override.baseline)) ? Number(override.baseline) : inspectorState[id].baseline,
      min: Number.isFinite(Number(override.min)) ? Number(override.min) : inspectorState[id].min,
      max: Number.isFinite(Number(override.max)) ? Number(override.max) : inspectorState[id].max,
      locked: typeof override.locked === "boolean" ? override.locked : inspectorState[id].locked,
      dirty: true,
    };
  }
  state.inspector = renderAssumptionInspector(assumptions, variables, {
    state: inspectorState,
    onChange(_inspectorState, overrides) {
      state.overrides = overrides;
      overrideOutput.textContent = JSON.stringify(overrides, null, 2);
      previewPlanParameterPatch();
      liveControls?.setValues(overrides);
      scheduleLiveSimulation();
    },
  });
  state.overrides = state.inspector.getOverrides();
  overrideOutput.textContent = JSON.stringify(state.overrides, null, 2);
}

function mountLiveExperiment() {
  $("#rerun-live").disabled = false;
  // Invalidate pending work before replacing controls or loading another experiment.
  clearTimeout(liveTimer);
  liveRequest += 1;
  liveControls?.destroy();
  state.liveResult = null;
  liveView.update(null);
  liveControls = mountLiveParameterControls($("#live-parameters"), {
    experiment: state.experiment,
    overrides: state.overrides,
    onChange(overrides) {
      renderLabAssumptions(state.experiment, overrides || {});
      previewPlanParameterPatch();
      scheduleLiveSimulation();
    },
  });
  scheduleLiveSimulation(0);
}

function scheduleLiveSimulation(delay = 180) {
  if (!state.experiment) return;
  clearTimeout(liveTimer);
  // Increment immediately: an older run must not paint during the debounce.
  const request = ++liveRequest;
  liveView.setPending(true);
  liveStatus.textContent = "Recalculating paired timelines…";
  liveTimer = setTimeout(async () => {
    const experiment = state.experiment;
    const overrides = structuredClone(state.overrides);
    const seed = Number(experiment.experiment?.seed);
    const years = Number(experiment.experiment?.horizonYears);
    try {
      const result = await runLiveSimulation({
        experiment, overrides,
        seed: Number.isFinite(seed) ? seed : 42,
        years: Number.isFinite(years) && years > 0 ? years : 10,
        runs: 12,
      });
      if (request !== liveRequest) return;
      state.liveResult = result;
      liveView.update(result);
      liveStatus.textContent = "Up to date · baseline and current assumptions use the same seeds · 12 paired worlds.";
    } catch (error) {
      if (request !== liveRequest) return;
      const message = `Live simulation failed: ${error?.message || error}`;
      liveView.showError(message);
      liveStatus.textContent = message;
    } finally {
      if (request === liveRequest) liveView.setPending(false);
    }
  }, delay);
}

$("#rerun-live").addEventListener("click", () => scheduleLiveSimulation(0));

function setStatus(message, error = false) {
  status.textContent = message;
  status.style.color = error ? "#e89a9a" : "#aab6c0";
}

function extractExperiment(payload, request = {}) {
  return resolveCivicExperimentPayload(payload, request);
}

function renderExperiment(experiment, provenance = null, initialOverrides = {}) {
  state.experiment = experiment;
  updateContinuity();
  const variables = experiment.worldModel?.variables || [];
  const causalEdges = experiment.worldModel?.causalEdges || [];
  const feedbackLoops = experiment.worldModel?.feedbackLoops || [];
  summary.innerHTML = `
    <h3>${escapeHtml(experiment.plan?.title || "Civic plan")}</h3>
    <p class="notice">${variables.length} inferred variables · ${causalEdges.length} causal edges · ${feedbackLoops.length} feedback loops · ${experiment.experiment?.runs ?? "?"} requested runs · ${experiment.experiment?.horizonYears ?? "?"} year horizon</p>
  `;
  const metrics = experiment.outcomes?.metricRegistry || [];
  metricRegistry.innerHTML = metrics.length
    ? `<h3>Metric registry</h3><div class="notice">${metrics.slice(0, 10).map((metric) => `${escapeHtml(metric.label)} <small>(${escapeHtml(metric.direction)})</small>`).join(" · ")}${metrics.length > 10 ? ` · +${metrics.length - 10} more` : ""}</div>`
    : `<div class="notice">No metric registry available.</div>`;
  renderLabAssumptions(experiment, initialOverrides);
  mountLiveExperiment();
  previewPlanParameterPatchButton.disabled = false;
  previewPlanParameterPatch();
  generateWorldsButton.disabled = false;
  saveExperimentButton.disabled = false;
  copyPensieveHandoffButton.disabled = false;
  downloadPensieveHandoffButton.disabled = false;
  openPensieveButton.disabled = !pensieveUrlInput.value.trim();
  pensieveStatus.textContent = "Experiment ready to package for Pensieve.";
  runVerificationButton.disabled = false;
  verificationOutput.textContent = "Ready to verify this experiment.";
  state.worldBatch = null;
  worldSummary.textContent = "Ready to generate worlds.";
  worldPreview.textContent = "[]";
  state.simulationBatch = null;
  runSimulationsButton.disabled = true;
  simulationSummary.textContent = "Generate worlds first.";
  simulationPreview.textContent = "[]";
  state.analyzedExperiment = null;
  state.scenarioComparison = null;
  outcomeSummary.innerHTML = `<div class="notice">Run simulations first.</div>`;
  scenarioFamilySummary.innerHTML = `<p class="notice">Run simulations first.</p>`;
  scenarioFamilyComparison.replaceChildren();
  scenarioFamilyDiagnosis.replaceChildren();
  scenarioTargetSelect.replaceChildren();
  scenarioTargetSelect.disabled = true;
  targetScenarioImprovementsButton.disabled = true;
  scenarioTargetStatus.textContent = "Run simulations first.";
  tailPreview.textContent = "[]";
  landscapeSvg.replaceChildren();
  landscapeSelection.textContent = "Run simulations to populate the landscape.";
  renderRealityInspector(realityInspector, null, experiment);
  state.sensitivity = null;
  sensitivityOutput.innerHTML = `<p class="notice">Run simulations first.</p>`;
  state.improvements = [];
  improvementOutput.innerHTML = `<p class="notice">Run sensitivity analysis first.</p>`;
  improvementResult.textContent = "";
  state.improvementComparison = null;
  state.revisionDraft = null;
  prepareRevisionButton.disabled = true;
  sendRevisionButton.disabled = true;
  revisionStatus.textContent = "Run a paired improvement test first.";
  revisionPreview.textContent = "{}";
  const sourceLabel = provenance?.source ? ` · ${provenance.source}` : "";
  const warning = provenance?.warning ? ` · WARNING: ${provenance.warning}` : "";
  setStatus(`Loaded ${experiment.id}${sourceLabel}${warning}`, Boolean(provenance?.warning));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function variableForPatch(parameterId, fallback = null) {
  return state.experiment?.worldModel?.variables?.find((variable) => variable.id === parameterId) || fallback;
}

function renderParameterPatch(patch, options = {}) {
  state.parameterPatch = patch;
  if (!patch) {
    planParameterPatchSummary.textContent = "Preview plan changes to see a parameter diff.";
    planParameterPatchPreview.replaceChildren();
    applyPlanParameterPatchButton.disabled = true;
    return;
  }

  const edits = patch.edits || [];
  const additions = patch.additions || [];
  const total = edits.length + additions.length;
  const applied = Boolean(options.applied || patch.alreadyApplied);
  const warnings = patch.warnings || [];
  const unconnected = additions.filter((row) => !row.connected).length;

  planParameterPatchSummary.textContent = applied
    ? `Already applied · ${edits.length} edits · ${additions.length} additions`
    : total
      ? `${edits.length} edits · ${additions.length} additions · ${patch.summary?.heuristicEditCount || 0} heuristic`
      : "No parameter changes were inferred from this plan.";
  applyPlanParameterPatchButton.disabled = applied || total === 0;

  const editRows = edits.map((edit) => {
    const variable = variableForPatch(edit.parameterId, edit);
    const sourceLabel = edit.source === "explicit-plan-parameter" ? "explicit" : "heuristic";
    return `<article class="parameter-patch-row">
      <div><strong>${escapeHtml(edit.label || edit.parameterId)}</strong><small>${escapeHtml(edit.parameterId)} <span class="parameter-patch-badge">${sourceLabel}</span></small></div>
      <div class="parameter-patch-change">${escapeHtml(formatVariableValue(variable, edit.from))} → ${escapeHtml(formatVariableValue(variable, edit.to))}</div>
      <div class="parameter-patch-reason">${escapeHtml(edit.reason || "Plan-derived parameter change.")}${edit.evidence?.length ? ` · matched: ${escapeHtml(edit.evidence.join(", "))}` : ""}</div>
    </article>`;
  }).join("");

  const additionRows = additions.map((addition) => {
    const variable = addition.variable || {};
    const binding = addition.connected ? "connected" : "unconnected";
    return `<article class="parameter-patch-row">
      <div><strong>${escapeHtml(variable.label || addition.parameterId)}</strong><small>${escapeHtml(addition.parameterId)} <span class="parameter-patch-badge">NEW</span> <span class="parameter-patch-badge">${binding}</span></small></div>
      <div class="parameter-patch-change">${escapeHtml(formatVariableValue(variable, addition.proposedValue))}</div>
      <div class="parameter-patch-reason">${escapeHtml(addition.reason || "Plan-defined simulation parameter.")}</div>
    </article>`;
  }).join("");

  const notes = [
    unconnected ? `<div class="warning" style="margin-top:10px">${unconnected} new parameter${unconnected === 1 ? "" : "s"} will appear as sliders and be sampled, but will not affect HBL outcomes until connected to model mechanics or a causal binding.</div>` : "",
    warnings.length ? `<div class="warning" style="margin-top:10px">${escapeHtml(warnings.join(" "))}</div>` : "",
  ].join("");

  planParameterPatchPreview.innerHTML = total
    ? `<div class="parameter-patch-list">${editRows}${additionRows}</div>${notes}`
    : `<p class="notice">The plan can still be simulated with the current assumptions. Add explicit <code>parameterEdits</code> or <code>simulationParameters</code> to the plan when you want deterministic plan → slider changes.</p>`;
}

function previewPlanParameterPatch() {
  if (!state.experiment) {
    renderParameterPatch(null);
    return null;
  }
  try {
    const patch = compilePlanParameterPatch(state.experiment, state.overrides);
    renderParameterPatch(patch);
    return patch;
  } catch (error) {
    state.parameterPatch = null;
    planParameterPatchSummary.textContent = `Could not compile parameter patch: ${error?.message || error}`;
    planParameterPatchPreview.replaceChildren();
    applyPlanParameterPatchButton.disabled = true;
    return null;
  }
}

async function loadFromApi() {
  setStatus("Loading Dear Congress plan through HBL…");
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ runs: 1000, years: 10, seed: 42 }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  input.value = JSON.stringify(payload, null, 2);
  const resolved = extractExperiment(payload, { runs: 1000, years: 10, seed: 42 });
  renderExperiment(resolved.experiment, resolved);
}

async function loadSimulationSnapshot(params) {
  const id = params.get("simulation");
  setStatus(`Loading frozen Dear Congress snapshot ${id}…`);
  const response = await fetch(`/api/dear-congress/simulation-snapshots/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  const snapshot = body?.snapshot;
  if (!response.ok || !snapshot?.plan) throw new Error(body?.error || `Snapshot unavailable (HTTP ${response.status})`);
  const request = { runs: 1000, years: 10, seed: 42 };
  for (const key of ["runs", "years", "seed"]) {
    const value = params.get(key);
    if (value !== null && value.trim() && Number.isFinite(Number(value))) request[key] = Number(value);
  }
  // Snapshot financial values are denominated in billions of dollars. The civic
  // contract accepts budget/cost, while frozen DC snapshots use budgetB/costB.
  const snapshotPlan = {
    ...snapshot.plan,
    budget: snapshot.plan.budget ?? snapshot.plan.budgetB,
    items: (snapshot.plan.items || []).map((item) => ({
      ...item,
      cost: item.cost ?? item.costB,
    })),
  };
  const resolved = extractExperiment({ plan: snapshotPlan, id: snapshot.id }, request);
  resolved.experiment.plan.source = {
    ...resolved.experiment.plan.source,
    endpoint: `/api/simulation-snapshots/${id}`,
    simulationSnapshotId: snapshot.id || id,
    budgetB: snapshot.plan.budgetB,
    totalCostB: snapshot.plan.totalCostB,
    costUnit: "USD billions",
  };
  input.value = JSON.stringify(resolved.experiment, null, 2);
  renderExperiment(resolved.experiment, { source: `Dear Congress snapshot ${id}` });
}

$("#load-plan").addEventListener("click", () => {
  loadFromApi().catch((error) => setStatus(error.message, true));
});

$("#load-json").addEventListener("click", () => {
  try {
    const resolved = extractExperiment(JSON.parse(input.value), { runs: 1000, years: 10, seed: 42 });
    renderExperiment(resolved.experiment, resolved);
  } catch (error) {
    setStatus(error.message, true);
  }
});

previewPlanParameterPatchButton.addEventListener("click", () => {
  previewPlanParameterPatch();
});

applyPlanParameterPatchButton.addEventListener("click", () => {
  if (!state.experiment) return;
  const patch = state.parameterPatch || previewPlanParameterPatch();
  if (!patch) return;
  try {
    const result = applyPlanParameterPatch(state.experiment, patch, state.overrides);
    if (!result.applied) {
      renderParameterPatch({ ...patch, alreadyApplied: true }, { applied: true });
      setStatus("This plan parameter patch was already applied.");
      return;
    }
    renderExperiment(result.experiment, { source: "plan-parameter-patch", warning: null }, result.overrides);
    state.parameterPatch = patch;
    renderParameterPatch({ ...patch, alreadyApplied: true }, { applied: true });
    setStatus(`Applied ${patch.summary?.editCount || 0} plan edits and ${patch.summary?.additionCount || 0} new parameters to the slider configuration.`);
  } catch (error) {
    planParameterPatchSummary.textContent = `Apply failed: ${error?.message || error}`;
  }
});

runVerificationButton.addEventListener("click", async () => {
  if (!state.experiment) return;
  runVerificationButton.disabled = true;
  verificationOutput.textContent = "Running invariant checks…";
  try {
    const report = await runExperimentVerification(state.experiment, { runs: 24 });
    verificationOutput.textContent = `${report.ok ? "ALL CHECKS PASSED" : "CHECKS FAILED"}\n\n${formatVerificationReport(report)}`;
  } catch (error) {
    verificationOutput.textContent = `FAIL  verifier  ${error?.message || error}`;
  } finally {
    runVerificationButton.disabled = false;
  }
});

window.hblExperimentLab = state;


generateWorldsButton.addEventListener("click", () => {
  if (!state.experiment) return;
  state.worldBatch = generateWorlds(state.experiment, { overrides: state.overrides });
  const first = state.worldBatch.worlds.slice(0, 3);
  const familyCount = Object.values(state.worldBatch.scenarioFamilyCounts || {}).filter((count) => count > 0).length;
  worldSummary.textContent = `${state.worldBatch.runs} deterministic worlds · seed ${state.worldBatch.seed} · ${state.worldBatch.variableIds.length} variables · ${familyCount} scenario families`;
  worldPreview.textContent = JSON.stringify(first, null, 2);
  state.simulationBatch = null;
  runSimulationsButton.disabled = false;
  simulationSummary.textContent = "Ready to run simulations.";
  simulationPreview.textContent = "[]";
});


function percent(value) {
  return value == null ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
}

function renderScenarioComparison(comparison) {
  state.scenarioComparison = comparison;
  if (!comparison?.families?.length) {
    scenarioFamilySummary.innerHTML = `<p class="notice">No scenario-family metadata was found in these simulations.</p>`;
    scenarioFamilyComparison.replaceChildren();
    scenarioFamilyDiagnosis.replaceChildren();
    scenarioTargetSelect.replaceChildren();
    scenarioTargetSelect.disabled = true;
    targetScenarioImprovementsButton.disabled = true;
    scenarioTargetStatus.textContent = "Generate scenario-family worlds before targeting an improvement.";
    return;
  }

  const weak = comparison.weakestFamily;
  const strong = comparison.strongestFamily;
  scenarioFamilySummary.innerHTML = `
    <div class="metric-cards">
      <div class="metric-card"><strong>${escapeHtml(weak?.label || "—")}</strong><span>weakest family</span></div>
      <div class="metric-card"><strong>${percent(weak?.robustness)}</strong><span>weak-family robustness</span></div>
      <div class="metric-card"><strong>${escapeHtml(strong?.label || "—")}</strong><span>strongest family</span></div>
      <div class="metric-card"><strong>${comparison.familyCount}</strong><span>scenario families sampled</span></div>
    </div>`;

  scenarioFamilyComparison.innerHTML = comparison.families.map((family) => {
    const robust = Math.max(0, Math.min(1, Number(family.robustness ?? 0)));
    const classes = [family.id === comparison.weakestFamilyId ? "weakest" : "", family.id === comparison.strongestFamilyId ? "strongest" : ""].filter(Boolean).join(" ");
    return `<div class="scenario-row ${classes}">
      <div><strong>${escapeHtml(family.label)}</strong><div class="scenario-meta">${family.worlds} worlds · score ${family.expectedScore ?? "—"}</div></div>
      <div class="scenario-bar" title="Robustness ${percent(family.robustness)}"><span style="width:${(robust * 100).toFixed(1)}%"></span></div>
      <div>${percent(family.robustness)}</div>
      <div class="scenario-meta">negative ${percent(family.adverseRate)}</div>
    </div>`;
  }).join("");

  const drivers = (weak?.distinguishingConditions || []).slice(0, 6);
  const paths = (weak?.causalPathways || []).slice(0, 4);
  const driverRows = drivers.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.pattern)}</td><td>${row.delta == null ? "—" : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(3)}`}</td></tr>`).join("");
  const pathRows = paths.map((row) => `<tr><td>${escapeHtml(row.description)}</td><td>${escapeHtml(String(row.target).replaceAll("_", " "))}</td><td>${row.meanEffect == null ? "—" : `${row.meanEffect >= 0 ? "+" : ""}${row.meanEffect.toFixed(3)}`}</td></tr>`).join("");
  scenarioFamilyDiagnosis.innerHTML = weak ? `
    <h3>Why ${escapeHtml(weak.label)} is difficult</h3>
    <p class="notice">This is a contrast inside the HBL model: conditions that distinguish this family from the other sampled families, not proof of real-world causation.</p>
    ${driverRows ? `<table class="analysis-table"><thead><tr><th>Condition</th><th>Family contrast</th><th>Δ normalized</th></tr></thead><tbody>${driverRows}</tbody></table>` : ""}
    ${pathRows ? `<h3>Active modeled pathways</h3><table class="analysis-table"><thead><tr><th>Pathway</th><th>Target</th><th>Mean effect</th></tr></thead><tbody>${pathRows}</tbody></table>` : ""}
  ` : "";

  scenarioTargetSelect.innerHTML = comparison.families.map((family) => `<option value="${escapeHtml(family.id)}"${family.id === comparison.weakestFamilyId ? " selected" : ""}>${escapeHtml(family.label)} · ${percent(family.robustness)} robust</option>`).join("");
  scenarioTargetSelect.disabled = false;
  targetScenarioImprovementsButton.disabled = false;
  scenarioTargetStatus.textContent = weak ? `Weakest sampled family: ${weak.label}. Targeting changes the improvement search, not the sampled worlds.` : "Select a scenario family to target.";
}

function renderSimulationBatch(batch) {
  state.simulationBatch = batch;
  updateContinuity();
  const modelLabel = batch.adapter.predictive
    ? "predictive adapter"
    : batch.adapter.modelClass === "stress-test"
      ? "NON-PREDICTIVE stress test"
      : "NON-PREDICTIVE systems model";
  simulationSummary.textContent = `${batch.simulations.length} runs · ${batch.adapter.label} · ${modelLabel}`;
  simulationPreview.textContent = JSON.stringify(batch.simulations.slice(0, 3), null, 2);
  const outcome = summarizeOutcomes(batch);
  state.analyzedExperiment = attachOutcomeAnalysis(state.experiment, batch);
  outcomeSummary.innerHTML = `
    <div class="metric-card"><strong>${outcome.expectedScore ?? "—"}</strong><span>expected score</span></div>
    <div class="metric-card"><strong>${percent(outcome.robustness)}</strong><span>robust worlds</span></div>
    <div class="metric-card"><strong>${percent(outcome.adverseRate)}</strong><span>negative worlds</span></div>
    <div class="metric-card"><strong>${outcome.p10Score ?? "—"}</strong><span>10th percentile</span></div>
    <div class="metric-card"><strong>${outcome.worstScore ?? "—"}</strong><span>worst sampled world</span></div>
  `;
  tailPreview.textContent = JSON.stringify(outcome.tailRisks, null, 2);
  const scenarioComparison = summarizeScenarioFamilies(batch, state.experiment);
  renderScenarioComparison(scenarioComparison);
  state.analyzedExperiment = {
    ...state.analyzedExperiment,
    analysis: { ...(state.analyzedExperiment?.analysis || {}), scenarioFamilies: scenarioComparison },
  };
  updateContinuity();
  const projection = projectOutcomeLandscape(batch.simulations);
  renderOutcomeLandscape(landscapeSvg, projection, {
    onSelect(point) {
      landscapeSelection.textContent = `${point.id} · score ${point.score} · ${point.status}`;
      renderRealityInspector(realityInspector, point.simulation, state.experiment);
      window.dispatchEvent(new CustomEvent("hbl:reality-selected", { detail: point }));
    },
  });
  landscapeSelection.textContent = `${projection.points.length} realities · ${projection.method}`;
  const worst = [...batch.simulations].sort((a, b) => a.score - b.score)[0];
  if (worst) renderRealityInspector(realityInspector, worst, state.experiment);
  state.sensitivity = analyzeSensitivity(batch, state.experiment);
  const top = state.sensitivity.sensitivities.slice(0, 10);
  const failures = state.sensitivity.failureModes.slice(0, 6);
  const rows = top.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.direction)}</td><td>${row.correlation.toFixed(3)}</td></tr>`).join("");
  const failureRows = failures.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.pattern)}</td><td>${row.delta.toFixed(3)}</td></tr>`).join("");
  sensitivityOutput.innerHTML = `
    <h3>Top sensitivities</h3>
    <table class="analysis-table"><thead><tr><th>Variable</th><th>Category</th><th>Association</th><th>r</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>Failure-mode separation</h3>
    ${failureRows ? `<table class="analysis-table"><thead><tr><th>Variable</th><th>Pattern</th><th>Δ normalized</th></tr></thead><tbody>${failureRows}</tbody></table>` : `<p class="notice">Not enough positive and negative worlds to compare failure modes.</p>`}
  `;
  state.improvements = generatePlanImprovements(state.experiment, state.sensitivity, { limit: 6 });
  renderImprovements();
}

runSimulationsButton.addEventListener("click", async () => {
  if (!state.experiment || !state.worldBatch) return;
  runSimulationsButton.disabled = true;
  try {
    const adapter = await resolveSimulationAdapter(window);
    simulationSummary.textContent = `Running ${state.worldBatch.runs} worlds with ${adapter.label}…`;
    state.simulationBatch = await simulateExperiment(state.experiment, state.worldBatch, adapter, {
      concurrency: 24,
      onProgress({ completed, total }) {
        if (completed === total || completed % 100 === 0) simulationSummary.textContent = `Running ${completed}/${total}…`;
      },
    });
    renderSimulationBatch(state.simulationBatch);
  } catch (error) {
    simulationSummary.textContent = `${error.message}. ${state.simulationBatch ? 'Earlier completed results remain visible.' : 'No completed results are available.'} Check your connection and select Run worlds to retry.`;
  } finally {
    runSimulationsButton.disabled = false;
  }
});


targetScenarioImprovementsButton.addEventListener("click", () => {
  if (!state.experiment || !state.scenarioComparison) return;
  const familyId = scenarioTargetSelect.value;
  const family = state.scenarioComparison.families.find((row) => row.id === familyId);
  if (!family) return;
  const targetedAnalysis = scenarioTargetingAnalysis(state.scenarioComparison, familyId);
  state.improvements = generatePlanImprovements(state.experiment, targetedAnalysis, {
    limit: 6,
    minimumCorrelation: 0.03,
    targetScenarioFamily: { id: family.id, label: family.label },
  });
  renderImprovements();
  scenarioTargetStatus.textContent = state.improvements.length
    ? `Improvement search now targets ${family.label}. Test a candidate below on the same complete world batch.`
    : `No strong modeled mitigation candidate was found for ${family.label}.`;
});

function renderImprovements() {
  if (!state.improvements.length) {
    improvementOutput.innerHTML = `<p class="notice">No strong improvement candidates were found in this batch.</p>`;
    return;
  }
  improvementOutput.innerHTML = `<div class="improvement-list">${state.improvements.map((item, index) => `
    <article class="improvement-card">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <small>${escapeHtml(item.targetVariableLabel)} · modeled ${item.simulationEffect.direction} ${(item.simulationEffect.strength * 100).toFixed(0)}%${item.targetScenarioFamily?.label ? ` · target: ${escapeHtml(item.targetScenarioFamily.label)}` : ""}</small>
      <button data-improvement-index="${index}">Test on same worlds</button>
    </article>`).join("")}</div>`;
  improvementOutput.querySelectorAll("[data-improvement-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const improvement = state.improvements[Number(button.dataset.improvementIndex)];
      await testImprovement(improvement, button);
    });
  });
}

function updateContinuity() {
  continuity.update({ evidence: 'synthetic', worldMutation: false, assumptions: state.experiment?.worldModel?.variables || [], objectives: state.experiment?.outcomes?.metricRegistry || [], constraints: state.experiment?.plan?.constraints || [], model: state.simulationBatch?.adapter || null, results: state.analyzedExperiment?.outcomes || state.scenarioComparison || null, lineage: { parentRecordId: state.parentRecordId } }, state.recordId ? { namespace: 'civic', experimentId: state.recordId } : undefined);
}
async function refreshLineageOutput(recordId = state.recordId) {
  updateContinuity();
  const records = await listExperimentRecords(100);
  const chain = recordId ? traceRecordLineage(records, recordId) : [];
  lineageOutput.textContent = JSON.stringify(chain.map(summarizeExperimentRecord), null, 2);
}

async function restoreRecord(record) {
  if (!record?.experiment) throw new Error("Saved record does not contain an experiment");
  if (record.continuity) { try { continuity.restoreContext(record.continuity); } catch (error) { recordStatus.textContent = `Saved context unavailable: ${error.message}`; } }
  state.recordId = record.id;
  state.parentRecordId = record.lineage?.parentRecordId || null;
  renderExperiment(record.experiment, { source: "saved-record", warning: null }, record.overrides || {});
  state.recordId = record.id;
  state.parentRecordId = record.lineage?.parentRecordId || null;
  state.worldBatch = record.worldBatch || null;
  if (state.worldBatch) {
    worldSummary.textContent = `${state.worldBatch.runs} restored worlds · seed ${state.worldBatch.seed}`;
    worldPreview.textContent = JSON.stringify(state.worldBatch.worlds?.slice(0, 3) || [], null, 2);
    runSimulationsButton.disabled = false;
  }
  if (record.simulationBatch) renderSimulationBatch(record.simulationBatch);
  state.sensitivity = record.sensitivity || state.sensitivity;
  state.scenarioComparison = record.scenarioComparison || state.scenarioComparison;
  if (record.scenarioComparison && !record.simulationBatch) renderScenarioComparison(record.scenarioComparison);
  state.improvements = record.improvements?.length ? record.improvements : state.improvements;
  state.improvementComparison = record.improvementComparison || null;
  prepareRevisionButton.disabled = !state.improvementComparison;
  if (state.improvements.length) renderImprovements();
  recordStatus.textContent = `Loaded ${record.id} · saved ${record.savedAt}`;
  copyExperimentLinkButton.disabled = false;
  const url = new URL(location.href);
  url.searchParams.set("experiment", record.id);
  history.replaceState(null, "", url);
  await refreshLineageOutput(record.id);
}

saveExperimentButton.addEventListener("click", async () => {
  if (!state.experiment) return;
  saveExperimentButton.disabled = true;
  try {
    const record = createExperimentRecord({
      experiment: state.experiment,
      overrides: state.overrides,
      worldBatch: state.worldBatch,
      simulationBatch: state.simulationBatch,
      analyzedExperiment: state.analyzedExperiment,
      sensitivity: state.sensitivity,
      scenarioComparison: state.scenarioComparison,
      improvements: state.improvements,
      improvementComparison: state.improvementComparison,
      parentRecordId: state.recordId || state.parentRecordId,
      revision: state.experiment?.lineage?.revision || 1,
    });
    if (continuity.getContext()) record.continuity = recordContext(continuity.getContext(), { namespace: 'civic', experimentId: record.id });
    await saveExperimentRecord(record);
    state.parentRecordId = state.recordId || state.parentRecordId;
    state.recordId = record.id;
    recordStatus.textContent = `Saved ${record.id} · ${record.worldBatch?.runs || 0} worlds · ${record.simulationBatch?.simulations?.length || 0} results`;
    copyExperimentLinkButton.disabled = false;
    const url = new URL(location.href);
    url.searchParams.set("experiment", record.id);
    history.replaceState(null, "", url);
    await refreshLineageOutput(record.id);
  } catch (error) {
    recordStatus.textContent = `Save failed: ${error?.message || error}`;
  } finally {
    saveExperimentButton.disabled = false;
  }
});

loadLatestExperimentButton.addEventListener("click", async () => {
  try {
    const [latest] = await listExperimentRecords(1);
    if (!latest) throw new Error("No saved experiments in this browser");
    await restoreRecord(latest);
  } catch (error) {
    recordStatus.textContent = `Load failed: ${error?.message || error}`;
  }
});

copyExperimentLinkButton.addEventListener("click", async () => {
  if (!state.recordId) return;
  const url = new URL(location.href);
  url.searchParams.set("experiment", state.recordId);
  try {
    await navigator.clipboard.writeText(url.href);
    recordStatus.textContent = `Copied local replay link for ${state.recordId}`;
  } catch {
    recordStatus.textContent = url.href;
  }
});

(async () => {
  const params = new URL(location.href).searchParams;
  const recordId = params.get("experiment");
  if (!recordId) {
    if (params.get("simulation")) {
      try { await loadSimulationSnapshot(params); }
      catch (error) {
        setStatus(`Could not load frozen snapshot: ${error?.message || error}`, true);
        liveStatus.textContent = "Snapshot unavailable. Retry the link or load a plan above.";
      }
    }
    return;
  }
  try {
    const record = await loadExperimentRecord(recordId);
    if (record) await restoreRecord(record);
    else recordStatus.textContent = `Saved record ${recordId} was not found in this browser.`;
  } catch (error) {
    recordStatus.textContent = `Could not restore ${recordId}: ${error?.message || error}`;
  }
})();

function currentPensieveRecord() {
  return createExperimentRecord({
    experiment: state.experiment,
    overrides: state.overrides,
    worldBatch: state.worldBatch,
    simulationBatch: state.simulationBatch,
    analyzedExperiment: state.analyzedExperiment,
    sensitivity: state.sensitivity,
    scenarioComparison: state.scenarioComparison,
    improvements: state.improvements,
    improvementComparison: state.improvementComparison,
    parentRecordId: state.parentRecordId,
    revision: state.experiment?.lineage?.revision || 1,
  });
}

function currentPensieveHandoff() {
  if (!state.experiment) throw new Error("Load an experiment first");
  const record = currentPensieveRecord();
  if (state.recordId) record.id = state.recordId;
  return buildPensieveHandoff({ record, sourceUrl: location.href });
}

pensieveUrlInput.value = window.HBL_PENSIEVE_URL || localStorage.getItem("hbl:pensieve-url") || "";
pensieveUrlInput.addEventListener("input", () => {
  localStorage.setItem("hbl:pensieve-url", pensieveUrlInput.value.trim());
  openPensieveButton.disabled = !state.experiment || !pensieveUrlInput.value.trim();
});

copyPensieveHandoffButton.addEventListener("click", async () => {
  try {
    const handoff = currentPensieveHandoff();
    const json = serializePensieveHandoff(handoff);
    await navigator.clipboard.writeText(json);
    pensieveStatus.textContent = `Copied ${handoff.source.recordId || handoff.source.experimentId} handoff JSON.`;
  } catch (error) {
    pensieveStatus.textContent = `Copy failed: ${error?.message || error}`;
  }
});

downloadPensieveHandoffButton.addEventListener("click", () => {
  try {
    const handoff = currentPensieveHandoff();
    const filename = downloadPensieveHandoff(handoff);
    pensieveStatus.textContent = `Downloaded ${filename}.`;
  } catch (error) {
    pensieveStatus.textContent = `Download failed: ${error?.message || error}`;
  }
});

openPensieveButton.addEventListener("click", () => {
  try {
    const handoff = currentPensieveHandoff();
    const url = buildPensieveLaunchUrl(pensieveUrlInput.value.trim(), handoff);
    const target = window.open(url, "_blank", "noopener");
    pensieveStatus.textContent = target === null
      ? "Pensieve popup was blocked. The handoff JSON is still available to copy/download."
      : `Opened Pensieve for ${handoff.source.experimentId}. Import the handoff JSON until the Pensieve receiver is wired.`;
  } catch (error) {
    pensieveStatus.textContent = `Open failed: ${error?.message || error}`;
  }
});

prepareRevisionButton.addEventListener("click", () => {
  if (!state.experiment || !state.improvementComparison) return;
  state.revisionDraft = buildDearCongressRevisionDraft({
    experiment: state.experiment,
    improvement: state.improvementComparison.improvement,
    comparison: state.improvementComparison,
    recordId: state.recordId,
    context: continuity.getContext(),
  });
  revisionPreview.textContent = JSON.stringify(state.revisionDraft, null, 2);
  revisionStatus.textContent = "Draft prepared locally. Review it before sending.";
  sendRevisionButton.disabled = false;
});

sendRevisionButton.addEventListener("click", async () => {
  if (!state.revisionDraft) return;
  sendRevisionButton.disabled = true;
  revisionStatus.textContent = "Sending revision draft to Dear Congress…";
  try {
    const response = await postDearCongressRevisionDraft(state.revisionDraft, { globalObject: window });
    revisionStatus.textContent = `Dear Congress accepted the draft${response?.id ? ` · ${response.id}` : ""}.`;
  } catch (error) {
    revisionStatus.textContent = `Send failed: ${error?.message || error}. If Dear Congress expects another body shape, configure window.HBL_DEAR_CONGRESS_REVISION_MAPPER.`;
  } finally {
    sendRevisionButton.disabled = false;
  }
});

async function testImprovement(improvement, button) {
  if (!state.worldBatch || !state.simulationBatch) return;
  button.disabled = true;
  improvementResult.textContent = `Testing “${improvement.title}” on the same ${state.worldBatch.runs} worlds…`;
  try {
    const revised = applyPlanImprovement(state.experiment, improvement);
    const adapter = await resolveSimulationAdapter(window);
    const rerun = await simulateExperiment(revised, state.worldBatch, adapter, { concurrency: 24 });
    const before = summarizeOutcomes(state.simulationBatch);
    const after = summarizeOutcomes(rerun);
    const pct = (value) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
    const scoreDelta = (after.expectedScore ?? 0) - (before.expectedScore ?? 0);
    state.improvementComparison = {
      improvement,
      revisedExperiment: revised,
      before,
      after,
      scoreDelta,
      worldCount: state.worldBatch.runs,
      worldBatchId: state.worldBatch.id || null,
    };
    state.revisionDraft = null;
    prepareRevisionButton.disabled = false;
    sendRevisionButton.disabled = true;
    revisionStatus.textContent = "Paired improvement test ready to turn into a Dear Congress revision draft.";
    revisionPreview.textContent = "{}";
    improvementResult.textContent = `Paired test: robustness ${pct(before.robustness)} → ${pct(after.robustness)} · expected score ${before.expectedScore} → ${after.expectedScore} (${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(1)}). This is a modeled hypothesis, not causal evidence.`;
  } catch (error) {
    improvementResult.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
