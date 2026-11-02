/** Fork and bounded optimization UI. No mutation happens here: promotion and
 * candidate application invoke onProposeEdit and the host approval preview.
 * Fork route POST /api/decision-experiments/:id/forks {runId,month,operations}.
 * Optimization POST /api/decision-optimizations {input,scenarioId,levers,
 * objectives,constraints,candidateCount,finalists}; then :id/start|cancel/results.
 */
import { housingModel, stressPresets, validateHousingFork } from "../models/housing/index.js";
import { createBuildingProposal, validateBuildingPlacement } from "../buildings/proposal.js";
import { hashWorldEditProposal } from "../ai/revisions.js";
import { optimizationCandidateProposal } from "./optimization.js";
import { getWorldRevisionId, fingerprintWorldInput } from "../ai/edit-schema.js";
const clone = (value) => structuredClone(value);
const node = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
const number = (value) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
async function request(path, body) { const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`); return result; }
export function mountExploration(container, { getInput, getResults, getSelectedRun, onApplyInput, onProposeEdit, onSelectRun, onEnterFuture } = {}) {
  let context = {}, forkResult = null, job = null, timer = null, destroyed = false, pending = false, pendingFork = null;
  const root = node("section"); root.className = "decision-exploration";
  root.innerHTML = `<style>.decision-exploration{display:grid;gap:18px}.decision-exploration section{border:1px solid #34444d;padding:16px;border-radius:12px;min-width:0}.decision-exploration h3{margin:0 0 8px}.decision-exploration label{display:inline-flex;flex-direction:column;gap:4px;margin:6px 12px 8px 0;font-size:12px}.decision-exploration input,.decision-exploration select,.decision-exploration button{font:inherit;padding:7px;border:1px solid #53646c;border-radius:6px;background:#15282e;color:inherit}.decision-exploration button{cursor:pointer;margin:4px}.decision-exploration button:disabled{opacity:.5;cursor:default}.decision-exploration table{border-collapse:collapse;width:100%;font-size:12px}.decision-exploration td,.decision-exploration th{padding:7px;text-align:left;border-bottom:1px solid #34444d}.decision-exploration .table-scroll{overflow:auto}.decision-exploration svg{width:100%;height:190px;background:#11232b;border-radius:8px}.decision-exploration .muted{opacity:.75;font-size:12px}.decision-exploration .exploration-error{color:#ffb6a7}</style>
  <section><h3>Fork from this future</h3><p class="muted">Keep the selected future's recorded history. Apply one intervention after a chosen completed month. Source results remain immutable.</p><p data-source>Select a successful future first.</p>
  <label>Completed month<input data-month type="number" min="0" value="24" step="1"></label><label>Intervention<select data-fork-type><option value="parameter">Change policy lever</option><option value="building">Add an approved building</option><option value="stress">Start a stress preset</option></select></label>
  <label>Policy lever<select data-fork-parameter></select></label><label>New value<input data-fork-value type="number" value="100000" step="any"></label><label>Stress preset<select data-fork-stress></select></label>
  <label>Building X (meters; blank finds a valid site)<input data-building-x type="number" step="any"></label><label>Building Z (meters)<input data-building-z type="number" step="any"></label>
  <button data-fork>Preview timeline fork</button><p data-fork-status aria-live="polite"></p><div data-fork-output></div></section>
  <section><h3>Find a better plan</h3><p class="muted">Bounded exploratory search: up to six 100-run screens and two 500-run finalists, paired against your current plan. Constraints apply to sampled means. No global-optimum claim.</p>
  <label>Current scenario<select data-scenario></select></label><div data-levers></div>
  <label>Primary objective<select data-objective></select></label><label>Direction<select data-direction><option value="minimize">Minimize</option><option value="maximize">Maximize</option></select></label>
  <label>Second objective<select data-second><option value="">None</option></select></label><label>Second direction<select data-second-direction><option value="minimize">Minimize</option><option value="maximize">Maximize</option></select></label>
  <label>Mean constraint<select data-constraint><option value="">No constraint</option></select></label><label>Constraint operator<select data-operator><option value="lte">At most</option><option value="gte">At least</option></select></label><label>Constraint value<input data-limit type="number" value="5000000000" step="any"></label>
  <label>Candidates<input data-count type="number" min="1" max="6" value="4"></label><label>Finalists<input data-finalists type="number" min="1" max="2" value="2"></label>
  <button data-optimize>Start bounded search</button><button data-cancel disabled>Cancel search</button><p data-job-status aria-live="polite"></p><progress data-progress value="0" max="1"></progress><div data-job-output></div></section>`;
  container.append(root);
  const find = (selector) => root.querySelector(selector);
  const input = () => getInput?.() || context.input;
  const results = () => getResults?.() || context.results;
  const selected = () => getSelectedRun?.() || context.selectedRun;
  function options(select, definitions) { for (const definition of definitions) { const option = node("option", definition.label || definition.name); option.value = definition.id; select.append(option); } }
  const policyIds = ["construction_capacity", "permitting_months", "zoning_density", "subsidy_amount", "voucher_funding", "adoption", "implementation_delay", "transit_share"];
  options(find("[data-fork-parameter]"), housingModel.parameters.filter((parameter) => policyIds.includes(parameter.id)));
  find("[data-fork-parameter]").value = "construction_capacity";
  options(find("[data-fork-stress]"), stressPresets.map((preset) => ({ id: preset.id, label: preset.name })));
  for (const selector of ["[data-objective]", "[data-second]", "[data-constraint]"]) options(find(selector), housingModel.metrics);
  find("[data-objective]").value = "median_rent"; find("[data-constraint]").value = "public_expenditure";
  for (const id of ["construction_capacity", "permitting_months", "zoning_density"]) {
    const definition = housingModel.parameters.find((row) => row.id === id); const row = node("label");
    row.append(node("span", `${definition.label} (${definition.unit})`));
    const enabled = node("input"); enabled.type = "checkbox"; enabled.checked = id !== "zoning_density"; enabled.dataset.lever = id;
    const min = node("input"); min.type = "number"; min.step = "any"; min.dataset.min = id;
    const max = node("input"); max.type = "number"; max.step = "any"; max.dataset.max = id;
    min.value = id === "construction_capacity" ? "60000" : id === "permitting_months" ? "3" : "1";
    max.value = id === "construction_capacity" ? "120000" : id === "permitting_months" ? "18" : "2.4";
    min.setAttribute("aria-label", `${definition.label} minimum`); max.setAttribute("aria-label", `${definition.label} maximum`);
    row.append(enabled, min, max); find("[data-levers]").append(row);
  }
  function state() {
    const run = selected(), data = results();
    if (pendingFork && (pendingFork.boundInput !== fingerprintWorldInput(input()) || pendingFork.boundRun !== `${data?.experiment?.id}/${run?.id}`)) { pendingFork = null; find("[data-fork-output]").replaceChildren(); find("[data-fork-status]").textContent = "Selected future or inputs changed. Preview a new fork before approval."; }
    const approve = find("[data-approve-fork]"); if (approve) approve.disabled = Boolean(context.readOnly || context.busy || pending);
    find("[data-source]").textContent = run ? `${run.id} · seed ${run.seed} · ${run.modelVersion} · ${run.scenarioId}` : "Select a successful future first.";
    find("[data-month]").max = String(Math.max(0, (data?.experiment?.years || input()?.years || 10) * 12 - 1));
    find("[data-fork]").disabled = Boolean(context.readOnly || context.busy || pending || !run || run.status !== "completed" || !data?.experiment?.id);
    find("[data-optimize]").disabled = Boolean(context.readOnly || context.busy || pending || job?.status === "running");
    find("[data-cancel]").disabled = job?.status !== "running" || context.readOnly;
  }
  async function safe(action, target) { try { pending = true; state(); await action(); } catch (error) { target.textContent = error.message; target.className = "exploration-error"; } finally { pending = false; if (!destroyed) state(); } }
  find("[data-fork-parameter]").addEventListener("change", () => { const definition = housingModel.parameters.find((row) => row.id === find("[data-fork-parameter]").value); find("[data-fork-value]").value = definition.default; });
  find("[data-fork]").addEventListener("click", () => safe(async () => {
    const run = selected(), data = results(); const type = find("[data-fork-type]").value;
    let operation;
    if (type === "parameter") operation = { op: "set_parameter", target: find("[data-fork-parameter]").value, value: Number(find("[data-fork-value]").value) };
    else if (type === "stress") operation = { op: "apply_stress_preset", target: "stressPresets", value: find("[data-fork-stress]").value };
    else {
      const existing = data.experiment.scenarios.find((scenario) => scenario.id === run.scenarioId)?.projects || [];
      const placement = data.experiment.metadata?.placementContext || {};
      const proposal = createBuildingProposal({ status: "approved", name: "Fork housing tower", location: { districtId: null, x: 0, z: 0 } });
      const sites = [];
      if (find("[data-building-x]").value.trim() && find("[data-building-z]").value.trim()) sites.push({ x: Number(find("[data-building-x]").value), z: Number(find("[data-building-z]").value) });
      else { const bounds = placement.bounds || { minX: -240, maxX: 240, minZ: -240, maxZ: 240 }; for (let x = bounds.minX + 30; x < bounds.maxX - 30; x += 60) for (let z = bounds.minZ + 30; z < bounds.maxZ - 30; z += 60) sites.push({ x, z }); }
      const site = sites.find((location) => validateBuildingPlacement({ ...proposal, location: { ...proposal.location, ...location } }, { ...placement, buildings: [...(placement.buildings || []), ...existing.filter((project) => project.status !== "cancelled")] }).valid);
      if (!site) throw new Error("No valid fork building site found. Enter valid X/Z coordinates or choose a parameter intervention.");
      proposal.location = { ...proposal.location, ...site }; operation = { op: "add_building", target: "world.projects", value: proposal };
    }
    const endpoint = `/api/decision-experiments/${data.experiment.id}/forks`;
    const body = { runId: run.id, month: Number(find("[data-month]").value), operations: [operation] };
    const checked = validateHousingFork({ month: body.month, operations: body.operations }, { years: data.experiment.years }); if (!checked.valid) throw new Error(checked.errors.join("; "));
    const previewHash = await hashWorldEditProposal(body);
    const boundInput = fingerprintWorldInput(input()), boundRun = `${data.experiment.id}/${run.id}`;
    pendingFork = { boundInput, boundRun };
    find("[data-fork-status]").textContent = "Hypothetical branch validated. No simulation, inputs, or history changed. Review and approve to run.";
    const box = find("[data-fork-output]"); box.replaceChildren();
    box.append(node("pre", JSON.stringify({ schemaVersion: "intervention.v1", sourceRunId: run.id, sourceSeed: run.seed, unchangedThroughMonth: body.month, appliesAtMonth: body.month + 1, operations: body.operations }, null, 2)));
    const approve = node("button", "Approve intervention & simulate fork"); approve.dataset.approveFork = ""; approve.onclick = () => safe(async () => {
      if (context.readOnly || context.busy || !pendingFork || fingerprintWorldInput(input()) !== boundInput || `${results()?.experiment?.id}/${selected()?.id}` !== boundRun) throw new Error("Fork preview is stale or read-only. Review the intervention again.");
      forkResult = await request(endpoint, { ...body, approval: true, previewHash }); pendingFork = null; renderFork();
    }, find("[data-fork-status]"));
    const reject = node("button", "Reject fork preview"); reject.onclick = () => { pendingFork = null; box.replaceChildren(); find("[data-fork-status]").textContent = "Preview rejected. Inputs, history, and results unchanged."; };
    box.append(approve, reject);
  }, find("[data-fork-status]")));
  for (const selector of ["[data-month]", "[data-fork-type]", "[data-fork-parameter]", "[data-fork-value]", "[data-fork-stress]", "[data-building-x]", "[data-building-z]"]) find(selector).addEventListener("input", () => { if (pendingFork) { pendingFork = null; find("[data-fork-output]").replaceChildren(); find("[data-fork-status]").textContent = "Fork fields changed. Preview the new intervention before approval."; } });
  function timelineSVG(original, current, metricId) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 680 190"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Original and fork ${metricId} timeline; original cyan, fork amber`);
    const a = original.monthlyTimeline || original.timeline, b = current.monthlyTimeline || current.timeline;
    const all = [...a, ...b].map((row) => row.metrics?.[metricId]).filter(Number.isFinite); if (!all.length) return svg;
    const low = Math.min(...all), span = Math.max(...all) - low || 1;
    for (const [rows, color] of [[a, "#63d8db"], [b, "#ffcc77"]]) { const poly = document.createElementNS(svg.namespaceURI, "polyline"); poly.setAttribute("points", rows.map((row, index) => `${20 + index / Math.max(1, rows.length - 1) * 640},${170 - (row.metrics[metricId] - low) / span * 145}`).join(" ")); poly.setAttribute("fill", "none"); poly.setAttribute("stroke", color); poly.setAttribute("stroke-width", "2"); svg.append(poly); }
    return svg;
  }
  function renderFork() {
    const box = find("[data-fork-output]"); box.replaceChildren();
    find("[data-fork-status]").textContent = `Fork saved. History through month ${forkResult.lineage.month} is identical; edits begin next month. Cyan: original · amber: fork.`;
    box.append(timelineSVG(forkResult.originalRun, forkResult.run, "median_rent"));
    const table = node("table"); const header = node("tr"); for (const label of ["Metric", "Original", "Fork", "Delta"]) header.append(node("th", label)); table.append(header);
    for (const metric of housingModel.metrics.slice(0, 7)) { const row = node("tr"); for (const value of [metric.label, number(forkResult.originalRun.metrics[metric.id]), number(forkResult.run.metrics[metric.id]), number(forkResult.deltas[metric.id])]) row.append(node("td", value)); table.append(row); } box.append(table);
    const enter = node("button", "Enter fork future"); enter.onclick = () => onEnterFuture?.(forkResult.run); box.append(enter);
    const promote = node("button", "Propose fork as a new scenario"); promote.disabled = Boolean(context.readOnly); promote.onclick = () => {
      const currentInput = input(); const source = results().experiment.scenarios.find((scenario) => scenario.id === forkResult.lineage.sourceScenarioId);
      const scenario = clone(source); delete scenario.inheritsFrom; delete scenario.overrides;
      scenario.id = `fork_${crypto.randomUUID().slice(0, 8)}`; scenario.name = `Fork · ${source.name}`; scenario.kind = "alternative";
      scenario.timelineFork = { ...forkResult.lineage, mode: "scenario" };
      onProposeEdit?.({ schemaVersion: "world-edit.v1", summary: "Promote the post-branch intervention into a new paired scenario", scenarioId: source.id, operations: [{ op: "add_scenario", target: "scenarios", value: scenario }], warnings: ["The saved fork replays one selected future. This scenario applies that month-specific intervention across new paired futures, retaining the source scenario uncertainty."], requiresSimulationRerun: true, provider: "user", model: "housing-timeline-fork.v1", baseRevision: getWorldRevisionId(currentInput), baseInputFingerprint: fingerprintWorldInput(currentInput) });
    }; box.append(promote);
    const link = node("a", "Open immutable fork results"); link.href = forkResult.experiment.shareUrl; link.target = "_blank"; link.rel = "noopener"; box.append(link);
  }
  find("[data-optimize]").addEventListener("click", () => safe(async () => {
    const objectives = [{ metricId: find("[data-objective]").value, direction: find("[data-direction]").value }]; if (find("[data-second]").value) objectives.push({ metricId: find("[data-second]").value, direction: find("[data-second-direction]").value });
    const levers = [...root.querySelectorAll("[data-lever]:checked")].map((checkbox) => ({ parameterId: checkbox.dataset.lever, min: Number(find(`[data-min="${checkbox.dataset.lever}"]`).value), max: Number(find(`[data-max="${checkbox.dataset.lever}"]`).value) }));
    const constraints = find("[data-constraint]").value ? [{ metricId: find("[data-constraint]").value, operator: find("[data-operator]").value, value: Number(find("[data-limit]").value) }] : [];
    ({ job } = await request("/api/decision-optimizations", { input: input(), sourceExperimentId: results()?.experiment?.id, scenarioId: find("[data-scenario]").value, levers, objectives, constraints, candidateCount: Number(find("[data-count]").value), finalists: Number(find("[data-finalists]").value) }));
    ({ job } = await request(`/api/decision-optimizations/${job.id}/start`, {})); renderJob(); pollJob();
  }, find("[data-job-status]")));
  find("[data-cancel]").addEventListener("click", () => safe(async () => { ({ job } = await request(`/api/decision-optimizations/${job.id}/cancel`, {})); renderJob(); }, find("[data-job-status]")));
  async function pollJob() { clearTimeout(timer); if (destroyed || !job || !["created", "running"].includes(job.status)) return; try { ({ job } = await request(`/api/decision-optimizations/${job.id}/results`)); if (destroyed) return; renderJob(); state(); timer = setTimeout(pollJob, 350); } catch (error) { find("[data-job-status]").textContent = error.message; } }
  function renderJob() {
    find("[data-job-status]").textContent = `${job.status} · ${job.progress.phase} · ${job.progress.completed}/${job.progress.total} evaluations · ${job.progress.failed || 0} failed${job.error ? ` · ${job.error}` : ""}`;
    find("[data-progress]").max = Math.max(1, job.progress.total); find("[data-progress]").value = job.progress.completed;
    const box = find("[data-job-output]"); box.replaceChildren();
    const table = node("table"), header = node("tr"); for (const text of ["Candidate", "Stage / futures", "Feasible", ...job.config.objectives.map((objective) => `${objective.metricId} mean`), "Paired delta", "Action"]) header.append(node("th", text)); table.append(header);
    for (const candidate of job.candidates || []) {
      const row = node("tr"); row.append(node("td", `${candidate.name}${job.pareto.includes(candidate.id) ? " · Pareto" : ""}`), node("td", `${candidate.stage} / ${candidate.runs || 0}`), node("td", candidate.feasible ? "Yes" : "No / pending"));
      for (const objective of job.config.objectives) row.append(node("td", number(candidate.aggregates?.metrics?.[objective.metricId]?.mean)));
      row.append(node("td", number(candidate.comparisons?.metrics?.[job.config.objectives[0].metricId]?.meanDelta)));
      const cell = node("td"), apply = node("button", "Propose alternative"); apply.disabled = Boolean(context.readOnly || context.busy || candidate.stage !== "finalist" || !candidate.feasible || input()?.scenarios?.length >= 8); apply.onclick = () => { if (!context.readOnly && !context.busy) onProposeEdit?.({ ...optimizationCandidateProposal({ input: input(), candidate, sourceScenarioId: job.config.scenarioId, job }), scenarioId: job.config.scenarioId }); }; cell.append(apply); row.append(cell); table.append(row);
    }
    const scroll = node("div"); scroll.className = "table-scroll"; scroll.append(table); box.append(scroll);
    const objectives = job.config.objectives;
    if (objectives.length === 2) {
      const candidates = job.candidates.filter((candidate) => candidate.aggregates?.metrics?.[objectives[0].metricId] && candidate.aggregates.metrics[objectives[1].metricId]);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 680 190"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Candidate tradeoff plot: ${objectives[0].metricId} horizontal, ${objectives[1].metricId} vertical. Amber marks feasible Pareto finalists.`);
      const values = (id) => candidates.map((candidate) => candidate.aggregates.metrics[id].mean);
      const x = values(objectives[0].metricId), y = values(objectives[1].metricId);
      for (let i = 0; i < candidates.length; i++) { const point = document.createElementNS(svg.namespaceURI, "circle"); point.setAttribute("cx", String(30 + (x[i] - Math.min(...x)) / (Math.max(...x) - Math.min(...x) || 1) * 620)); point.setAttribute("cy", String(160 - (y[i] - Math.min(...y)) / (Math.max(...y) - Math.min(...y) || 1) * 130)); point.setAttribute("r", "7"); point.setAttribute("fill", job.pareto.includes(candidates[i].id) ? "#ffcc77" : "#63d8db"); const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${candidates[i].name}: ${number(x[i])}, ${number(y[i])}`; point.append(title); svg.append(point); } box.append(svg, node("p", `X: ${objectives[0].metricId} · Y: ${objectives[1].metricId}. Amber: feasible Pareto finalists; cyan: other evaluated candidates.`));
    }
    const manifest = node("a", "Download optimization manifest"); manifest.href = `/api/decision-optimizations/${job.id}/manifest`; manifest.target = "_blank"; manifest.rel = "noopener"; box.append(manifest);
  }
  return { update(value = {}) { context = value; const select = find("[data-scenario]"), previous = select.value; select.replaceChildren(); options(select, (input()?.scenarios || []).map((scenario) => ({ id: scenario.id, label: scenario.name }))); select.value = (input()?.scenarios || []).some((scenario) => scenario.id === previous) ? previous : (input()?.scenarios || []).find((scenario) => scenario.kind !== "baseline")?.id || input()?.scenarios?.[0]?.id || ""; state(); }, destroy() { destroyed = true; clearTimeout(timer); root.remove(); } };
}
