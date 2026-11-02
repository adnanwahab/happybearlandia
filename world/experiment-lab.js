import { renderAssumptionInspector } from "./assumption-inspector.js";
import { generateWorlds } from "./world-generator.js";
import { selectSimulationAdapter, simulateExperiment } from "./simulation-adapter.js";
import { attachOutcomeAnalysis, summarizeOutcomes } from "./outcome-analysis.js";
import { projectOutcomeLandscape, renderOutcomeLandscape } from "./outcome-landscape.js";
import { renderRealityInspector } from "./reality-inspector.js";
import { analyzeSensitivity } from "./sensitivity-analysis.js";
import { applyPlanImprovement, generatePlanImprovements } from "./plan-improver.js";
import { resolveCivicExperimentPayload } from "./experiment-contract.js";
import { formatVerificationReport, runExperimentVerification } from "./experiment-verification.js";

const state = {
  experiment: null,
  inspector: null,
  overrides: {},
  worldBatch: null,
  simulationBatch: null,
  analyzedExperiment: null,
  sensitivity: null,
  improvements: [],
};

const $ = (selector) => document.querySelector(selector);
const status = $("#status");
const input = $("#json-input");
const assumptions = $("#assumptions");
const summary = $("#plan-summary");
const metricRegistry = $("#metric-registry");
const overrideOutput = $("#override-output");
const generateWorldsButton = $("#generate-worlds");
const worldSummary = $("#world-summary");
const worldPreview = $("#world-preview");
const runSimulationsButton = $("#run-simulations");
const simulationSummary = $("#simulation-summary");
const simulationPreview = $("#simulation-preview");
const outcomeSummary = $("#outcome-summary");
const tailPreview = $("#tail-preview");
const landscapeSvg = $("#outcome-landscape");
const landscapeSelection = $("#landscape-selection");
const realityInspector = $("#reality-inspector");
const sensitivityOutput = $("#sensitivity-output");
const improvementOutput = $("#improvement-output");
const improvementResult = $("#improvement-result");
const runVerificationButton = $("#run-verification");
const verificationOutput = $("#verification-output");

function setStatus(message, error = false) {
  status.textContent = message;
  status.style.color = error ? "#e89a9a" : "#aab6c0";
}

function extractExperiment(payload, request = {}) {
  return resolveCivicExperimentPayload(payload, request);
}

function renderExperiment(experiment, provenance = null) {
  state.experiment = experiment;
  const variables = experiment.worldModel?.variables || [];
  summary.innerHTML = `
    <h3>${escapeHtml(experiment.plan?.title || "Civic plan")}</h3>
    <p class="notice">${variables.length} inferred variables · ${experiment.experiment?.runs ?? "?"} requested runs · ${experiment.experiment?.horizonYears ?? "?"} year horizon</p>
  `;
  const metrics = experiment.outcomes?.metricRegistry || [];
  metricRegistry.innerHTML = metrics.length
    ? `<h3>Metric registry</h3><div class="notice">${metrics.slice(0, 10).map((metric) => `${escapeHtml(metric.label)} <small>(${escapeHtml(metric.direction)})</small>`).join(" · ")}${metrics.length > 10 ? ` · +${metrics.length - 10} more` : ""}</div>`
    : `<div class="notice">No metric registry available.</div>`;
  state.inspector = renderAssumptionInspector(assumptions, variables, {
    onChange(_inspectorState, overrides) {
      state.overrides = overrides;
      overrideOutput.textContent = JSON.stringify(overrides, null, 2);
    },
  });
  state.overrides = state.inspector.getOverrides();
  overrideOutput.textContent = JSON.stringify(state.overrides, null, 2);
  generateWorldsButton.disabled = false;
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
  outcomeSummary.innerHTML = `<div class="notice">Run simulations first.</div>`;
  tailPreview.textContent = "[]";
  landscapeSvg.replaceChildren();
  landscapeSelection.textContent = "Run simulations to populate the landscape.";
  renderRealityInspector(realityInspector, null, experiment);
  state.sensitivity = null;
  sensitivityOutput.innerHTML = `<p class="notice">Run simulations first.</p>`;
  state.improvements = [];
  improvementOutput.innerHTML = `<p class="notice">Run sensitivity analysis first.</p>`;
  improvementResult.textContent = "";
  const sourceLabel = provenance?.source ? ` · ${provenance.source}` : "";
  const warning = provenance?.warning ? ` · WARNING: ${provenance.warning}` : "";
  setStatus(`Loaded ${experiment.id}${sourceLabel}${warning}`, Boolean(provenance?.warning));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
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
  worldSummary.textContent = `${state.worldBatch.runs} deterministic worlds · seed ${state.worldBatch.seed} · ${state.worldBatch.variableIds.length} variables`;
  worldPreview.textContent = JSON.stringify(first, null, 2);
  state.simulationBatch = null;
  runSimulationsButton.disabled = false;
  simulationSummary.textContent = "Ready to run simulations.";
  simulationPreview.textContent = "[]";
});


runSimulationsButton.addEventListener("click", async () => {
  if (!state.experiment || !state.worldBatch) return;
  runSimulationsButton.disabled = true;
  try {
    const adapter = selectSimulationAdapter(window);
    simulationSummary.textContent = `Running ${state.worldBatch.runs} worlds with ${adapter.label}…`;
    state.simulationBatch = await simulateExperiment(state.experiment, state.worldBatch, adapter, {
      concurrency: 24,
      onProgress({ completed, total }) {
        if (completed === total || completed % 100 === 0) simulationSummary.textContent = `Running ${completed}/${total}…`;
      },
    });
    const predictive = state.simulationBatch.adapter.predictive ? "predictive adapter" : "NON-PREDICTIVE stress test";
    simulationSummary.textContent = `${state.simulationBatch.simulations.length} runs · ${state.simulationBatch.adapter.label} · ${predictive}`;
    simulationPreview.textContent = JSON.stringify(state.simulationBatch.simulations.slice(0, 3), null, 2);
    const outcome = summarizeOutcomes(state.simulationBatch);
    state.analyzedExperiment = attachOutcomeAnalysis(state.experiment, state.simulationBatch);
    const percent = (value) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
    outcomeSummary.innerHTML = `
      <div class="metric-card"><strong>${outcome.expectedScore ?? "—"}</strong><span>expected score</span></div>
      <div class="metric-card"><strong>${percent(outcome.robustness)}</strong><span>robust worlds</span></div>
      <div class="metric-card"><strong>${percent(outcome.adverseRate)}</strong><span>negative worlds</span></div>
      <div class="metric-card"><strong>${outcome.p10Score ?? "—"}</strong><span>10th percentile</span></div>
      <div class="metric-card"><strong>${outcome.worstScore ?? "—"}</strong><span>worst sampled world</span></div>
    `;
    tailPreview.textContent = JSON.stringify(outcome.tailRisks, null, 2);
    const projection = projectOutcomeLandscape(state.simulationBatch.simulations);
    renderOutcomeLandscape(landscapeSvg, projection, {
      onSelect(point) {
        landscapeSelection.textContent = `${point.id} · score ${point.score} · ${point.status}`;
        renderRealityInspector(realityInspector, point.simulation, state.experiment);
        window.dispatchEvent(new CustomEvent("hbl:reality-selected", { detail: point }));
      },
    });
    landscapeSelection.textContent = `${projection.points.length} realities · ${projection.method}`;
    const worst = [...state.simulationBatch.simulations].sort((a, b) => a.score - b.score)[0];
    if (worst) renderRealityInspector(realityInspector, worst, state.experiment);
    state.sensitivity = analyzeSensitivity(state.simulationBatch, state.experiment);
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
  } catch (error) {
    simulationSummary.textContent = error.message;
  } finally {
    runSimulationsButton.disabled = false;
  }
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
      <small>${escapeHtml(item.targetVariableLabel)} · modeled ${item.simulationEffect.direction} ${(item.simulationEffect.strength * 100).toFixed(0)}%</small>
      <button data-improvement-index="${index}">Test on same worlds</button>
    </article>`).join("")}</div>`;
  improvementOutput.querySelectorAll("[data-improvement-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const improvement = state.improvements[Number(button.dataset.improvementIndex)];
      await testImprovement(improvement, button);
    });
  });
}

async function testImprovement(improvement, button) {
  if (!state.worldBatch || !state.simulationBatch) return;
  button.disabled = true;
  improvementResult.textContent = `Testing “${improvement.title}” on the same ${state.worldBatch.runs} worlds…`;
  try {
    const revised = applyPlanImprovement(state.experiment, improvement);
    const adapter = selectSimulationAdapter(window);
    const rerun = await simulateExperiment(revised, state.worldBatch, adapter, { concurrency: 24 });
    const before = summarizeOutcomes(state.simulationBatch);
    const after = summarizeOutcomes(rerun);
    const pct = (value) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
    const scoreDelta = (after.expectedScore ?? 0) - (before.expectedScore ?? 0);
    improvementResult.textContent = `Paired test: robustness ${pct(before.robustness)} → ${pct(after.robustness)} · expected score ${before.expectedScore} → ${after.expectedScore} (${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(1)}). This is a modeled hypothesis, not causal evidence.`;
  } catch (error) {
    improvementResult.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
