import { fingerprintWorldInput } from "../ai/edit-schema.js";
import { analyzeDecision, successfulRuns } from "./analysis.js";
import { buildDecisionManifest, escapeHtml as esc, formatNumber as fmt, openDecisionBrief, renderBuildingAnalysis } from "./brief.js";
import { createHousingHistoryAdapter, runHistoricalBacktest, runPublishedHousingDiagnostic } from "./backtest.js";

const stringify = value => typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
const safe = value => esc(stringify(value));
const percentage = value => `${fmt(value * 100)}%`;
const fields = ["parameterId", "value", "unit", "source", "confidence", "notes", "date", "component", "type", "url"];

export function parseEvidenceCsv(input) {
  const rows = [], row = []; let value = "", quoted = false;
  const flushValue = () => { row.push(value); value = ""; };
  const flushRow = () => { flushValue(); if (row.some(cell => cell.trim())) rows.push(row.splice(0)); else row.splice(0); };
  const source = input.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index++; }
      else if (quoted || value === "") quoted = !quoted;
      else throw new Error("Invalid CSV quoting.");
    } else if (character === "," && !quoted) flushValue();
    else if ((character === "\n" || character === "\r") && !quoted) { flushRow(); if (character === "\r" && source[index + 1] === "\n") index++; }
    else value += character;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (value || row.length) flushRow();
  if (!rows.length) throw new Error("CSV is empty.");
  const headers = rows.shift().map(header => header.trim());
  if (!headers.includes("source") && !headers.includes("parameterId")) throw new Error("CSV needs a source or parameterId column.");
  return rows.map(cells => Object.fromEntries(headers.filter(header => fields.includes(header)).map(header => [header, cells[headers.indexOf(header)] ?? ""])));
}
export function parseEvidenceImport(content, filename = "evidence.json") {
  let records;
  if (/\.csv$/i.test(filename)) records = parseEvidenceCsv(content);
  else { const payload = JSON.parse(content); records = Array.isArray(payload) ? payload : payload.evidence; }
  if (!Array.isArray(records) || !records.length || records.length > 5000) throw new Error("Expected 1–5,000 evidence records.");
  return records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Invalid evidence row ${index + 1}.`);
    const result = Object.fromEntries(fields.filter(field => record[field] !== undefined).map(field => [field, stringify(record[field])]));
    return { ...result, id: `import-${index}-${Date.now()}`, type: result.type || (/\.csv$/i.test(filename) ? "CSV metadata" : "JSON metadata"), confidence: result.confidence || "Unverified", file: filename, notes: result.notes || "Imported source metadata; not applied to simulation parameters." };
  });
}
export function evidenceCsv(records) {
  const quote = value => { let string = stringify(value); if (/^[=+@\-\t\r]/.test(string)) string = `'${string}`; return `"${string.replace(/"/g, '""')}"`; };
  return [fields, ...records.map(record => fields.map(field => record[field] ?? ""))].map(row => row.map(quote).join(",")).join("\r\n");
}
function download(name, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Independent panel: owns only its container, with same progressive result object as visuals. */
export function mountDecisionTrust(container) {
  const root = document.createElement("section"); root.className = "decision-trust"; container.append(root);
  const stylesheet = document.createElement("link"); stylesheet.rel = "stylesheet"; stylesheet.href = new URL("./trust.css", import.meta.url).href; root.append(stylesheet);
  const content = document.createElement("div"); root.append(content);
  let data = {}, analysis = analyzeDecision(), evidence = [], localEvidence = [], inputEvidence = [], backtest = null, dataset = null, pendingImport = [], selectedRunId = "", currentKey = null, message = "", destroyed = false, backtestBusy = false, publishedResult = null, publishedBusy = false, robustnessReport = null;
  const readOnly = () => data.readOnly === true || data.readonly === true || new URL(location.href).searchParams.get("readonly") === "1" || new URL(location.href).searchParams.has("share");
  function persist() {
    evidence = [...inputEvidence, ...localEvidence];
    if (!currentKey || readOnly()) return;
    try { localStorage.setItem(currentKey, JSON.stringify(localEvidence)); }
    catch { message = "Evidence retained for this session; browser storage unavailable. Export to keep it."; }
  }
  const analyze = () => { analysis = analyzeDecision({ ...data, evidence }); };
  function render() {
    if (destroyed) return;
    const opened = new Map([...content.querySelectorAll("details")].map(element => [element.querySelector(":scope > summary")?.textContent.split(" · ")[0], element.open]));
    const active = content.contains(document.activeElement) ? document.activeElement : null;
    const draftForm = active?.closest("[data-evidence-form]");
    const draft = draftForm ? Object.fromEntries(new FormData(draftForm)) : null;
    const editIndex = draftForm?.dataset.editIndex;
    const cutoffValue = content.querySelector("[data-cutoff]")?.value;
    const targetValue = content.querySelector("[data-target]")?.value;
    const focusedName = active?.name;
    const model = data.model || {}, experiment = data.experiment;
    const label = id => (model.metrics || []).find(metric => metric.id === id)?.label || id || "primary outcome";
    const runs = successfulRuns(data.runs);
    const selectedRun = runs.find(run => run.id === selectedRunId) || runs[0];
    content.innerHTML = `<header class="dt-heading"><div><p class="dt-eyebrow">ANALYSIS + TRUST</p><h2>Understand the tradeoffs.</h2><p>Inspect the evidence behind these possible futures.</p></div><div class="dt-actions"><button type="button" data-action="brief" ${!experiment ? "disabled" : ""}>Decision brief / print</button><button type="button" data-action="manifest" ${!experiment ? "disabled" : ""}>Reproduce experiment</button></div></header>
      <p class="dt-status" role="status">${safe(message || (analysis.empty ? "Run an experiment to see analysis. Assumptions can be inspected before execution." : `${analysis.successful} successful stored runs analyzed. ${analysis.failed} failed runs excluded.`))}</p>
      <div class="dt-grid">
      <details open><summary>Which assumptions matter?</summary><p>Within-scenario association with ${safe(label(analysis.metricId))}. Pearson correlation is descriptive, not causal importance. Fixed inputs are omitted.</p>${analysis.sensitivities.length ? analysis.sensitivities.slice(0, 12).map(row => `<div class="dt-sensitivity"><div><strong>${safe(row.label)}</strong><small>${safe(row.scenarioName)} · n=${row.count} · r=${fmt(row.correlation)}</small></div><meter min="0" max="1" value="${row.magnitude}" aria-label="Absolute association for ${esc(row.label)}">${fmt(row.magnitude)}</meter></div>`).join("") : "<p class=\"dt-empty\">No varying inputs with at least three successful samples and nonzero outcome variance. Add uncertainty and run more futures.</p>"}</details>
      <details open><summary>Under what conditions does it fail?</summary><p>Unfavorable means strictly worse ${safe(label(analysis.metricId))} than the same-seed baseline. Each condition is a high/low quartile of that scenario’s sampled inputs. This separate baseline diagnostic does not relabel the cloud’s recorded success/failure criteria.</p>${analysis.failureClusters.map(cluster => `<div class="dt-cluster"><h3>${safe(cluster.scenarioName)} · ${cluster.count} / ${cluster.pairedCount} unfavorable futures</h3><p>${safe(cluster.definition)}</p>${cluster.conditions.length ? `<ul>${cluster.conditions.slice(0, 5).map(row => `<li><strong>${percentage(row.prevalence)}</strong> ${safe(row.tail)} ${safe(row.label)} (${row.tail === "high" ? "≥" : "≤"} ${fmt(row.threshold)} ${safe(row.unit)})<small>${row.count}/${row.denominator} unfavorable; ${percentage(row.referencePrevalence)} across all matched runs. Association, not attribution.</small></li>`).join("")}</ul>` : "<p>No varying condition evidence in unfavorable runs.</p>"}${cluster.runIds.length ? `<details><summary>Inspect unfavorable run IDs</summary><p>${cluster.runIds.map(safe).join(", ")}</p></details>` : ""}</div>`).join("") || "<p class=\"dt-empty\">Same-seed baseline and treatment results are needed.</p>"}</details>
      </div>
      <details open class="dt-building-report"><summary>Buildings, construction outcomes and approved edits</summary>${renderBuildingAnalysis(analysis.projectAnalysis, model)}${analysis.projectAnalysis?.limitations?.length ? `<ul>${analysis.projectAnalysis.limitations.map(item => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}</details>
      <details><summary>Why did this future happen?</summary><p>Inspect stored model drivers and event traces. No causal contribution percentages are invented.</p>${runs.length ? `<label>Stored future <select data-run-selector>${runs.map(run => `<option value="${esc(run.id)}" ${run.id === selectedRun?.id ? "selected" : ""}>${safe(run.scenarioId)} · ${safe(run.id)} · seed ${safe(run.seed)}</option>`).join("")}</select></label><pre>${safe(JSON.stringify({ drivers: selectedRun?.drivers ?? [], events: selectedRun?.events ?? [], projects: selectedRun?.projects?.map(project => ({ projectId: project.projectId, events: project.events, projection: project.projection || (selectedRun?.traceDelivery === "on-demand" ? "summary" : "full"), final: project.summary?.finalState || project.finalState || project.states?.at(-1) })) ?? [], projectMetrics: selectedRun?.projectMetrics ?? null }, null, 2))}</pre>` : "<p>No successful run traces yet.</p>"}</details>
      <details><summary>Show assumptions · ${analysis.assumptions.length} records</summary><p>Values come from this experiment’s scenario inputs. Metadata edits below annotate evidence; change model values in Parameter Studio and rerun.</p><div class="dt-table-wrap"><table><thead><tr><th>Scenario / input</th><th>Value / unit</th><th>Uncertainty</th><th>Source / confidence / date / component</th></tr></thead><tbody>${analysis.assumptions.map(row => { const attached = evidence.filter(item => item.parameterId === row.parameterId); return `<tr><td><strong>${safe(row.assumption)}</strong><small>${safe(row.scenarioName)}</small><small>${safe(row.notes)}</small></td><td>${safe(row.value)} ${safe(row.unit)}</td><td>${safe(row.uncertainty)}</td><td>${safe(row.source)} / ${safe(row.confidence)}<small>${safe(row.date)} · ${safe(row.component)}</small>${attached.map(item => `<small class="dt-source">Attached: ${safe(item.source || item.url || item.file)} · ${safe(item.confidence)} · ${safe(item.date || "date not supplied")}</small>`).join("")}</td></tr>`; }).join("")}</tbody></table></div></details>
      <details><summary>Evidence / source ledger · ${evidence.length} records</summary><p>Sources are user annotations, not automatically verified. JSON/CSV metadata imports do not change simulator inputs. Export evidence to keep or share it alongside a manifest.</p>${readOnly() ? "<p>Read-only shared view.</p>" : `<form data-evidence-form class="dt-evidence-form"><label>Parameter<select name="parameterId"><option value="">General model evidence</option>${(model.parameters || []).map(parameter => `<option value="${esc(parameter.id)}">${safe(parameter.label || parameter.id)}</option>`).join("")}</select></label><label>Value<input name="value" placeholder="Source value (metadata)"></label><label>Units<input name="unit"></label><label>Source / citation URL<input name="source" required maxlength="2000"></label><label>Confidence<select name="confidence"><option>Unverified</option><option>Low</option><option>Medium</option><option>High (user assessed)</option></select></label><label>Date<input name="date" type="date"></label><label>Model component<input name="component" value="${esc(model.id || "housing.v1")}"></label><label>Notes<textarea name="notes" maxlength="5000"></textarea></label><button type="submit">Add source record</button></form><label class="dt-import">Import evidence CSV / JSON metadata <input type="file" accept=".csv,.json,application/json,text/csv" data-evidence-file></label><small>CSV columns: ${fields.join(", ")}. Upload report metadata as JSON with source, date, notes and component. Report text is not extracted.</small>`}
      ${pendingImport.length ? `<div class="dt-preview"><h3>Preview ${pendingImport.length} imported records</h3><pre>${safe(JSON.stringify(pendingImport.slice(0, 5), null, 2))}</pre><button data-action="apply-import">Attach reviewed metadata</button><button data-action="discard-import">Discard</button></div>` : ""}
      <div class="dt-actions"><button data-action="export-evidence">Export evidence JSON</button><button data-action="export-csv">Export evidence CSV</button></div><div class="dt-evidence-list">${evidence.map((row, index) => `<article><strong>${safe(row.source || row.url || row.file || "Unspecified source")}</strong><small>${safe(row.parameterId || "General model")} · ${safe(row.type || "manual")} · ${safe(row.confidence || "Unverified")} · ${safe(row.date || "date not supplied")}</small><p>${safe(row.notes)}</p>${!readOnly() && index >= inputEvidence.length ? `<button data-action="edit-evidence" data-index="${index - inputEvidence.length}">Edit record</button> <button data-action="remove-evidence" data-index="${index - inputEvidence.length}">Remove record</button>` : ""}</article>`).join("") || "<p>No external sources attached. Model defaults remain unvalidated assumptions.</p>"}</div></details>
      <details><summary>Historical evaluation / calibration</summary><p>Import dated model inputs and held-out observations to compare observed vs simulated outcomes. Data must include date and availableAt; calibration only receives rows available by the cutoff.</p><label>Historical JSON dataset <input type="file" accept=".json,application/json" data-history-file ${readOnly() ? "disabled" : ""}></label><small>Format: {label, source, synthetic, observations:[{date, availableAt, parameters:{...}, metrics:{...}}]}. Rows after the cutoff are evaluation only. Also accepts housing adapter long-form observations {year, metricId, value, unit, geography, availableAt, sourceUrl}; those initialize from the earliest pre-cutoff year and fit rent response only on later pre-cutoff data. User sources remain unverified.</small><div class="dt-backtest-form"><label>Historical cutoff<input type="date" data-cutoff value="2015-01-01"></label><label>Target date<input type="date" data-target value="2025-01-01"></label><button data-action="backtest" ${!dataset || backtestBusy ? "disabled" : ""}>${backtestBusy ? "Evaluating…" : "Evaluate 100 held-out futures"}</button><button data-action="synthetic-history" ${backtestBusy ? "disabled" : ""}>Try clearly synthetic example</button></div><p>${dataset ? `Dataset: ${safe(dataset.label)} · ${dataset.synthetic !== false ? "SYNTHETIC / unverified demonstration" : "User-supplied observations; source unverified"} · ${safe(dataset.source)}` : "No historical dataset attached; no empirical calibration claimed."}</p><div data-backtest-output>${renderBacktest(backtest, model)}</div></details>
      <details open><summary>Published observation diagnostic · Houston</summary><p>Source-backed comparison with published housing stock estimates. This is retrospective model-fit inspection, not a blind historical backtest; ACS five-year survey windows overlap and the model coefficients remain synthetic.</p>${publishedResult ? renderBacktest(publishedResult, model) : `<p>${publishedBusy ? "Comparing 100 model runs with published housing stock…" : "Diagnostic requires the housing model."}</p>`}</details>
      <details><summary>Run manifest / reproduction</summary><p>Full model inputs, uncertainty, version, seed, run count, horizon and metric definitions are exported. Exact reproduction requires the recorded software version.</p>${experiment?.id ? `<a href="/api/decision-experiments/${encodeURIComponent(experiment.id)}/manifest" target="_blank" rel="noopener">Open server manifest</a>` : ""}<pre>${safe(JSON.stringify({ experimentId: experiment?.id, modelId: experiment?.modelId || model.id, modelVersion: experiment?.modelVersion || model.version, hblVersion: experiment?.hblVersion || experiment?.metadata?.hblVersion || "Not recorded", seed: experiment?.seed, runs: experiment?.runs, years: experiment?.years, createdAt: experiment?.createdAt, worldRevision: experiment?.metadata?.worldRevision?.id || experiment?.metadata?.worldRevision || null, approvedEdits: experiment?.metadata?.worldEditHistory?.length || 0, resultsSourceExperimentId: experiment?.metadata?.resultsSourceExperimentId || experiment?.resultsSourceExperimentId || null }, null, 2))}</pre><button data-action="manifest" ${!experiment ? "disabled" : ""}>Download reproduction manifest</button></details>
      <details><summary>Model methodology · exploratory badge</summary><p><b>Exploratory model · not empirically predictive.</b> ${safe(model.description || "No methodology description recorded.")}</p><p>Model boundary: ${safe(model.boundary || "Not recorded")} · version ${safe(experiment?.modelVersion || model.version)} · time step ${safe(model.timeStep || "Not recorded")}.</p><p>Stored runs drive outcome distributions. The intelligence panel distinguishes descriptive associations/bins from executed matched numerical interventions. Unsupported variance decomposition and causal contribution percentages are not reported. Approved interventions, fork lineage and bounded-search provenance travel in the decision brief and manifest.</p><p>${robustnessReport ? "A matching local robustness report is attached to the print/manifest export. It is a saved snapshot, not a new run; it is not automatically published in a server share link." : "No matching measured robustness report is attached; configured stress presets are not proof of robustness."}</p></details>
      <details open class="dt-limitations"><summary>Limitations and model boundary</summary><ul>${analysis.limitations.map(item => `<li>${safe(item)}</li>`).join("")}</ul></details>`;
    for (const element of content.querySelectorAll("details")) { const key = element.querySelector(":scope > summary")?.textContent.split(" · ")[0]; if (opened.has(key)) element.open = opened.get(key); }
    if (cutoffValue) content.querySelector("[data-cutoff]").value = cutoffValue;
    if (targetValue) content.querySelector("[data-target]").value = targetValue;
    if (draft) {
      const form = content.querySelector("[data-evidence-form]");
      if (form) { for (const [name, value] of Object.entries(draft)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value; if (editIndex !== undefined) { form.dataset.editIndex = editIndex; form.querySelector("button").textContent = "Save source changes"; } if (focusedName) form.elements.namedItem(focusedName)?.focus({ preventScroll: true }); }
    }
  }
  function renderBacktest(result, model) {
    if (!result) return "<p class=\"dt-empty\">No evaluation run. A historical holdout checks model behavior; it does not prove future predictive accuracy.</p>";
    return `<h3>${result.diagnostic ? "Published ACS estimates · retrospective diagnostic" : result.dataset.synthetic ? "SYNTHETIC workflow demonstration" : "User-provided historical evaluation"}</h3><p>${result.trainingCount} pre-cutoff records · initial state ${safe(result.startDate)} · information cutoff ${safe(result.cutoff)} · ${result.successful} successful simulations · ${result.failed} failed · observed ${safe(result.observedDate)}</p><div class="dt-table-wrap"><table><thead><tr><th>Metric</th><th>Observed</th><th>Simulated median / P10–P90</th><th>Observed percentile</th><th>Absolute error</th><th>Squared error</th><th>Absolute % error</th></tr></thead><tbody>${result.metrics.map(row => `<tr><td>${safe(model.metrics?.find(metric => metric.id === row.metricId)?.label || row.metricId)}</td><td>${fmt(row.observed)}</td><td>${fmt(row.median)} / ${fmt(row.p10)}–${fmt(row.p90)}</td><td><meter min="0" max="100" value="${row.observedPercentile}"></meter> ${fmt(row.observedPercentile)}%</td><td>${fmt(row.absoluteError)}</td><td>${fmt(row.squaredError)}</td><td>${fmt(row.absolutePercentageError)}</td></tr>`).join("")}</tbody></table></div><p>${safe(result.calibration)}</p>${result.sources ? `<ul>${result.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${safe(source.title || `Published ${source.year} source`)}</a><small>Housing units ${fmt(source.housing_supply)} · occupied ${fmt(source.occupied)} · assumed available ${safe(source.availableAt)}</small></li>`).join("")}</ul>` : ""}${result.calibrationAudit ? `<details><summary>Calibration audit / candidate errors</summary><pre>${safe(JSON.stringify(result.calibrationAudit, null, 2))}</pre></details>` : ""}<ul>${result.limitations.map(item => `<li>${safe(item)}</li>`).join("")}</ul>`;
  }
  async function loadPublishedDiagnostic(model) {
    if (publishedBusy || publishedResult || model?.id !== "housing.v1") return;
    publishedBusy = true;
    try { const pack = await import("../models/housing/index.js"); publishedResult = await runPublishedHousingDiagnostic({ simulate: pack.simulateHousingRun, model, runs: 100, seed: 42 }); }
    catch (error) { message = `Published observation diagnostic unavailable: ${error.message}`; }
    finally { publishedBusy = false; if (!destroyed) render(); }
  }
  async function evaluate() {
    if (!dataset || backtestBusy) return;
    const cutoff = content.querySelector("[data-cutoff]").value, targetDate = content.querySelector("[data-target]").value;
    backtestBusy = true; message = "Evaluating holdout with pre-cutoff inputs only…"; render();
    try {
      const pack = await import("../models/housing/index.js");
      const adapter = dataset.observations?.some(row => row.metricId && row.year) ? await createHousingHistoryAdapter(dataset.observations, { ...(dataset.importOptions || {}), synthetic: dataset.synthetic, label: dataset.label, source: dataset.source }) : dataset;
      const result = await runHistoricalBacktest({ adapter, cutoff, targetDate, simulate: pack.simulateHousingRun, runs: 100, seed: data.experiment?.seed ?? 42 });
      if (!destroyed) { backtest = result; message = "Evaluation complete. See historical evaluation; source and synthetic status remain visible."; }
    } catch (error) { message = `Backtest unavailable: ${error.message}`; }
    finally { backtestBusy = false; if (!destroyed) render(); }
  }
  async function action(event) {
    const button = event.target.closest("[data-action]"); if (!button || !root.contains(button)) return;
    const name = button.dataset.action;
    try {
      if (name === "brief") openDecisionBrief({ ...data, evidence, analysis, backtest: backtest || publishedResult, robustnessReport });
      if (name === "manifest") download("decision-reproduction.json", JSON.stringify(buildDecisionManifest({ ...data, evidence, backtest: backtest || publishedResult, robustnessReport }), null, 2));
      if (name === "export-evidence") download("decision-evidence.json", JSON.stringify({ schemaVersion: "decision-evidence.v1", evidence }, null, 2));
      if (name === "export-csv") download("decision-evidence.csv", evidenceCsv(evidence), "text/csv;charset=utf-8");
      if (name === "backtest") { await evaluate(); return; }
      if (name === "synthetic-history") {
        const pack = await import("../models/housing/index.js");
        const parameters = Object.fromEntries((data.model?.parameters || pack.housingModel.parameters).map(parameter => [parameter.id, parameter.default]));
        const observed = pack.simulateHousingRun({ parameters, seed: 19317, years: 10 });
        dataset = { id: "synthetic-housing-holdout", label: "Synthetic housing holdout (not real history)", source: "Generated by the housing model solely to demonstrate evaluation", synthetic: true, observations: [{ date: "2015-01-01", availableAt: "2015-01-01", parameters }, { date: "2025-01-01", availableAt: "2025-06-01", metrics: observed.metrics }] };
        message = "Synthetic dataset loaded. Evaluate the holdout to inspect the workflow; this is not empirical validation."; render();
      }
      if (!readOnly() && name === "apply-import") { localEvidence.push(...pendingImport); pendingImport = []; persist(); analyze(); render(); }
      if (name === "discard-import") { pendingImport = []; render(); }
      if (!readOnly() && name === "remove-evidence") { localEvidence.splice(Number(button.dataset.index), 1); persist(); analyze(); render(); }
      if (!readOnly() && name === "edit-evidence") {
        const index = Number(button.dataset.index), record = localEvidence[index], form = content.querySelector("[data-evidence-form]");
        if (!record || !form) return;
        for (const field of fields) if (form.elements.namedItem(field)) form.elements.namedItem(field).value = record[field] || "";
        form.dataset.editIndex = String(index); form.querySelector("button").textContent = "Save source changes"; form.scrollIntoView({ block: "nearest" });
      }
    } catch (error) { message = error.message; render(); }
  }
  function submit(event) {
    if (!event.target.matches("[data-evidence-form]")) return;
    event.preventDefault(); if (readOnly()) return;
    const form = event.target, record = Object.fromEntries(new FormData(form));
    record.type = "manual source metadata"; record.id = `evidence-${Date.now()}`;
    if (form.dataset.editIndex !== undefined) localEvidence[Number(form.dataset.editIndex)] = record;
    else localEvidence.push(record);
    form.reset(); delete form.dataset.editIndex; form.querySelector("button").focus();
    persist(); analyze(); message = "Evidence metadata saved locally. Export it for sharing or durable backup."; render();
  }
  async function change(event) {
    if (event.target.matches("[data-run-selector]")) { selectedRunId = event.target.value; render(); }
    const file = event.target.files?.[0]; if (!file || readOnly()) return;
    try {
      if (file.size > 2_000_000) throw new Error("Use a metadata file smaller than 2 MB.");
      if (event.target.matches("[data-evidence-file]")) { pendingImport = parseEvidenceImport(await file.text(), file.name); message = "Review imported records, then attach them to the ledger."; }
      if (event.target.matches("[data-history-file]")) {
        const value = JSON.parse(await file.text());
        if (!Array.isArray(value.observations) || !value.observations.length) throw new Error("Historical JSON needs an observations array.");
        dataset = { ...value, synthetic: value.synthetic !== false, label: value.label || file.name, source: value.source || "Unverified file upload" };
        backtest = null; message = "Historical dataset loaded. Choose the cutoff before evaluating.";
      }
    } catch (error) { message = error.message; }
    render();
  }
  function receiveRobustness(event) {
    const report = event.detail;
    if (destroyed || readOnly() || !data.experiment || report?.sourceFingerprint !== fingerprintWorldInput(data.experiment)) return;
    robustnessReport = structuredClone(report);
    message = "Matching robustness snapshot attached to print/manifest exports; cell statuses and source denominators remain visible.";
    render();
  }
  container.ownerDocument.addEventListener("decision:robustness-report", receiveRobustness);
  root.addEventListener("click", action); root.addEventListener("submit", submit); root.addEventListener("change", change);
  render();
  return { update(next = {}) {
    if (destroyed) return;
    const key = next.experiment?.id || next.experiment?.name || "draft";
    const storageKey = `hbl:decision:evidence:${key}`;
    if (currentKey !== storageKey) { currentKey = storageKey; backtest = null; robustnessReport = null; selectedRunId = ""; try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]"); localEvidence = Array.isArray(saved) ? saved : []; } catch { localEvidence = []; } }
    data = next; inputEvidence = Array.isArray(next.evidence) ? next.evidence : Array.isArray(next.experiment?.metadata?.evidence) ? next.experiment.metadata.evidence : [];
    if (readOnly()) localEvidence = [];
    robustnessReport = next.robustnessReport || next.experiment?.metadata?.robustnessReport || robustnessReport;
    if (!robustnessReport && next.experiment && !readOnly()) try { robustnessReport = JSON.parse(localStorage.getItem(`hbl.robustness.v1:${fingerprintWorldInput(next.experiment)}`) || "null"); } catch {}
    if (robustnessReport?.sourceFingerprint !== fingerprintWorldInput(next.experiment)) robustnessReport = null;
    evidence = [...inputEvidence, ...localEvidence]; analyze(); render();
    void loadPublishedDiagnostic(next.model);
  }, destroy() { destroyed = true; container.ownerDocument.removeEventListener("decision:robustness-report", receiveRobustness); root.removeEventListener("click", action); root.removeEventListener("submit", submit); root.removeEventListener("change", change); root.remove(); } };
}
