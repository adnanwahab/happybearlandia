import { renderAssumptionInspector } from "./assumption-inspector.js";
import { generateWorlds } from "./world-generator.js";
import { selectSimulationAdapter, simulateExperiment } from "./simulation-adapter.js";
import { attachOutcomeAnalysis, summarizeOutcomes } from "./outcome-analysis.js";
import { projectOutcomeLandscape, renderOutcomeLandscape } from "./outcome-landscape.js";

const state = {
  experiment: null,
  inspector: null,
  overrides: {},
  worldBatch: null,
  simulationBatch: null,
  analyzedExperiment: null,
};

const $ = (selector) => document.querySelector(selector);
const status = $("#status");
const input = $("#json-input");
const assumptions = $("#assumptions");
const summary = $("#plan-summary");
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

function setStatus(message, error = false) {
  status.textContent = message;
  status.style.color = error ? "#e89a9a" : "#aab6c0";
}

function extractExperiment(payload) {
  if (payload?.civicExperiment?.schemaVersion === "civic-experiment.v1") return payload.civicExperiment;
  if (payload?.schemaVersion === "civic-experiment.v1") return payload;
  throw new Error("JSON does not contain civicExperiment.v1");
}

function renderExperiment(experiment) {
  state.experiment = experiment;
  const variables = experiment.worldModel?.variables || [];
  summary.innerHTML = `
    <h3>${escapeHtml(experiment.plan?.title || "Civic plan")}</h3>
    <p class="notice">${variables.length} inferred variables · ${experiment.experiment?.runs ?? "?"} requested runs · ${experiment.experiment?.horizonYears ?? "?"} year horizon</p>
  `;
  state.inspector = renderAssumptionInspector(assumptions, variables, {
    onChange(_inspectorState, overrides) {
      state.overrides = overrides;
      overrideOutput.textContent = JSON.stringify(overrides, null, 2);
    },
  });
  state.overrides = state.inspector.getOverrides();
  overrideOutput.textContent = JSON.stringify(state.overrides, null, 2);
  generateWorldsButton.disabled = false;
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
  setStatus(`Loaded ${experiment.id}`);
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
  renderExperiment(extractExperiment(payload));
}

$("#load-plan").addEventListener("click", () => {
  loadFromApi().catch((error) => setStatus(error.message, true));
});

$("#load-json").addEventListener("click", () => {
  try {
    renderExperiment(extractExperiment(JSON.parse(input.value)));
  } catch (error) {
    setStatus(error.message, true);
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
        window.dispatchEvent(new CustomEvent("hbl:reality-selected", { detail: point }));
      },
    });
    landscapeSelection.textContent = `${projection.points.length} realities · ${projection.method}`;
  } catch (error) {
    simulationSummary.textContent = error.message;
  } finally {
    runSimulationsButton.disabled = false;
  }
});
