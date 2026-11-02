/** Studio integration: mountIntelligence(container,{onProposeEdit,onSelectRun})
 * returns {update(context),destroy()}. It reads immutable results, makes no API
 * provider calls and never applies edits. Numeric diagnostics use Housing's
 * version-resolved simulator helpers; all callbacks receive real stored rows.
 */
import { analyzeIntelligence, descriptiveBins, experimentOf, runsOf, proposeRuleFix, queryFuture, explainFuture, runPartialDependence } from "./intelligence.js";
import { escapeHtml as esc, formatNumber as fmt } from "./brief.js";
import { housingModel } from "../models/housing/index.js";
import { housingCausalRegistry } from "../models/housing/causal-registry.js";
import { runHousingCounterfactual, explainHousingRun } from "../models/housing/counterfactual.js";

const safe = value => esc(typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? "");
const pct = value => typeof value === "number" && Number.isFinite(value) ? `${fmt(value * 100)}%` : "Unavailable";
const table = (headers, rows) => `<div class="di-table"><table><thead><tr>${headers.map(safe).map(value => `<th>${value}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${safe(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const conditionLabel = condition => `${condition.label} ${condition.operator === "gte" ? "≥" : "≤"} ${fmt(condition.value)} ${condition.unit}`;

export function causalGraphSvg(registry, selectedId) {
  const nodes = registry?.nodes || [], edges = registry?.edges || [];
  if (!nodes.length) return "<p>No registered equation graph available.</p>";
  const level = new Map(nodes.map(node => [node.id, node.kind === "input" ? 0 : 1]));
  for (let index = 0; index < 5; index++) for (const edge of edges) level.set(edge.to, Math.min(5, Math.max(level.get(edge.to) || 1, (level.get(edge.from) || 0) + 1)));
  const groups = new Map(); for (const node of nodes) { const col = level.get(node.id); if (!groups.has(col)) groups.set(col, []); groups.get(col).push(node); }
  const height = Math.max(260, ...[...groups.values()].map(group => group.length * 43 + 25)), width = 1050;
  const position = new Map(); for (const [column, group] of groups) group.forEach((node, index) => position.set(node.id, { x: 8 + column * 173, y: 12 + index * 43 }));
  const reached = new Set(selectedId ? [selectedId] : []);
  for (let index = 0; index < nodes.length; index++) for (const edge of edges) if (reached.has(edge.from)) reached.add(edge.to);
  return `<div class="di-graph-scroll"><svg class="di-graph" viewBox="0 0 ${width} ${height}" role="group" aria-label="Interactive graph of implemented housing dependencies; select a node for equations and downstream links"><title>Implemented model dependencies, not an empirical causal network</title>${edges.map(edge => { const from = position.get(edge.from), to = position.get(edge.to); if (!from || !to) return ""; return `<path class="di-edge ${reached.has(edge.from) ? "di-ripple" : ""}" d="M${from.x + 155},${from.y + 15} C${from.x + 175},${from.y + 15} ${to.x - 15},${to.y + 15} ${to.x},${to.y + 15}"><title>${safe(edge.from)} → ${safe(edge.to)} · equation ${safe(edge.equationId)}</title></path>`; }).join("")}${nodes.map(node => { const point = position.get(node.id); return `<g class="di-node ${reached.has(node.id) ? "di-reached" : ""} ${node.id === selectedId ? "di-selected" : ""}" role="button" tabindex="0" data-causal-node="${esc(node.id)}" aria-label="Inspect ${esc(node.label)}" transform="translate(${point.x},${point.y})"><rect width="155" height="31" rx="5"/><text x="6" y="20">${safe(node.label.length > 23 ? `${node.label.slice(0, 22)}…` : node.label)}</text></g>`; }).join("")}</svg></div>`;
}

export function mountIntelligence(container, { onProposeEdit, onSelectRun } = {}) {
  if (!container?.ownerDocument) throw new TypeError("Intelligence requires a DOM container.");
  const doc = container.ownerDocument, root = doc.createElement("section"); root.className = "decision-intelligence"; root.dataset.testid = "decision-intelligence";
  const css = doc.createElement("link"); css.rel = "stylesheet"; css.href = new URL("./trust.css", import.meta.url).href; root.append(css);
  const body = doc.createElement("div"); root.append(body); container.append(root);
  let context = {}, analysis = analyzeIntelligence(), scenarioId = "", classificationMode = "recorded", metricId = "affordability", parameterId = "construction_capacity", referenceId = "", minCount = 3, minSupport = 0.1, selectedNode = "construction_capacity", attribution = null, partial = null, busy = false, message = "", query = "Why did this happen?", queryAnswer = null, destroyed = false, generation = 0, controller = null, sourceKey = null;
  const model = () => context.results?.model || context.model || housingModel;
  const experiment = () => experimentOf(context);
  const selected = () => { const rows = runsOf(context); if (context.selectedRun && rows.some(row => row.id === context.selectedRun.id) && (!context.selectedRun.experimentId || context.selectedRun.experimentId === experiment()?.id)) return context.selectedRun; return rows.find(run => run.id === context.selectedRunId) || rows.find(run => run.scenarioId === scenarioId) || rows[0]; };
  const reference = () => { const rows = runsOf(context), run = selected(); return rows.find(row => row.id === referenceId) || rows.find(row => row.scenarioId === experiment()?.scenarios?.find(item => item.kind === "baseline")?.id && row.seed === run?.seed) || rows.find(row => row.id !== run?.id); };
  function refresh() { analysis = analyzeIntelligence({ ...context, model: model() }, { scenarioId, metricId, minCount, minSupport, classificationMode }); }
  function ruleCards(rules, fixes) {
    if (!rules.length) return `<p class="di-empty">No ${fixes ? "failure rules" : "success patterns"} meet the selected minimum support/count and lift ≥1.05. Do not invent a pattern from sparse or uniform outcomes.</p>`;
    return rules.slice(0, 8).map(rule => {
      let proposal, reason = ""; try { proposal = fixes ? proposeRuleFix({ rule, input: context.input, model: model() }) : null; } catch (error) { reason = error.message; }
      return `<article class="di-rule"><h4>${rule.conditions.map(conditionLabel).map(safe).join(" AND ")}</h4><div class="di-rule-stats"><strong>${fmt(rule.lift)}× lift</strong><span>${rule.outcomeCount}/${rule.count} matching futures ${fixes ? "fail" : "succeed"}</span><span>Population base ${pct(rule.baseRate)} (${rule.targetCount}/${rule.populationCount})</span><span>Condition support ${pct(rule.support)} (${rule.count}/${rule.populationCount})</span><span>Conditional ${fixes ? "failure" : "success"} rate ${pct(rule.conditionalRate)}</span><span>Condition in ${fixes ? "failures" : "successes"}: ${pct(rule.prevalenceInTarget)}</span></div><p>Exploratory association; same discovery sample, not causal or validated out-of-sample.</p><div class="di-actions">${fixes ? `<button data-di-action="fix" data-rule="${esc(rule.id)}" ${!proposal || context.readOnly || context.busy ? "disabled" : ""}>TEST THIS FIX · review first</button>` : ""}<button data-di-action="inspect-rule" data-rule="${esc(rule.id)}" data-target="${rule.target}">Inspect a real ${fixes ? "unfavorable" : "successful"} future</button></div>${proposal ? `<small>Hypothesis: ${safe(proposal.summary)}. Replaces uncertainty for this parameter with a fixed test value. No promised improvement.</small>` : reason ? `<small>${safe(reason)}</small>` : ""}</article>`;
    }).join("");
  }
  function render() {
    if (destroyed) return;
    const opens = new Map([...body.querySelectorAll("details[data-di-section]")].map(element => [element.dataset.diSection, element.open]));
    const source = experiment(), rows = runsOf(context), run = selected(), compared = reference();
    const inScenario = analysis.classified.filter(row => row.run.scenarioId === scenarioId), count = kind => inScenario.filter(row => row.outcome === kind).length;
    const bins = descriptiveBins({ runs: rows, scenarioId, parameterId, metricId });
    const explanation = explainFuture({ run, referenceRun: compared, registry: housingCausalRegistry, attribution, metricId });
    const linkedEdges = housingCausalRegistry.edges.filter(edge => edge.from === selectedNode || edge.to === selectedNode), ids = new Set(linkedEdges.map(edge => edge.equationId));
    const equations = housingCausalRegistry.equations.filter(equation => ids.has(equation.id));
    const events = (run?.events || []).filter(event => equations.some(equation => equation.eventTypes?.includes(event.type)));
    const comparison = analysis.comparison;
    body.innerHTML = `<header class="di-heading"><div><p class="di-eyebrow">OBSERVED FAILURES → APPROVED HYPOTHESES</p><h3>Find the condition. Test a bounded fix.</h3><p>Rules and associations describe stored runs. Numerical model diagnostics are marked separately.</p></div><span class="di-badge">Exploratory · not predictive</span></header>
      <div class="di-controls"><label>Scenario<select data-di-control="scenario" aria-label="Intelligence scenario">${(source?.scenarios || []).map(scenario => `<option value="${esc(scenario.id)}" ${scenario.id === scenarioId ? "selected" : ""}>${safe(scenario.name || scenario.id)}</option>`).join("")}</select></label><label>Outcome labeling<select data-di-control="classification" aria-label="Outcome labeling mode"><option value="recorded" ${classificationMode === "recorded" ? "selected" : ""}>Recorded criteria · same as cloud</option><option value="paired-baseline" ${classificationMode === "paired-baseline" ? "selected" : ""}>Diagnostic · relative to baseline</option></select></label><label>Outcome metric<select data-di-control="metric" aria-label="Intelligence metric">${(model().metrics || []).map(metric => `<option value="${esc(metric.id)}" ${metric.id === metricId ? "selected" : ""}>${safe(metric.label)} (${safe(metric.unit)})</option>`).join("")}</select></label><label>Minimum matching outcomes<input type="number" min="2" max="1000" value="${minCount}" data-di-control="min-count" aria-label="Minimum rule count"></label><label>Minimum population support<input type="number" min="0.01" max="1" step="0.01" value="${minSupport}" data-di-control="support" aria-label="Minimum rule support"></label></div>
      ${classificationMode === "paired-baseline" ? '<p class="di-answer"><strong>Separate diagnostic mode:</strong> with no recorded criterion, “failure/success” below means unfavorable/favorable versus the same-seed baseline. These inferred comparison labels are not the cloud’s recorded outcome classes.</p>' : ""}
      <p class="di-status" role="status" aria-live="polite">${safe(message || (!rows.length ? "Run an experiment to analyze real futures. No demonstration outcomes have been fabricated." : `${count("failure")} failures · ${count("success")} successes · ${count("mixed")} mixed · ${count("unclassified")} unclassified in this scenario. ${inScenario[0]?.definition || ""}`))}</p>
      <div class="di-grid"><details open data-di-section="failures"><summary>Failure rules · support, base rates and lift</summary>${ruleCards(analysis.failureRules.filter(rule => rule.scenarioId === scenarioId), true)}</details><details data-di-section="success"><summary>Success patterns</summary>${ruleCards(analysis.successPatterns.filter(rule => rule.scenarioId === scenarioId), false)}</details></div>
      <details open data-di-section="sensitivity"><summary>Sensitivity tornado · descriptive associations</summary><p>Within this scenario, bars show Pearson |r| with the chosen outcome, not variance shares or causal contributions. Fixed inputs cannot be ranked from observational variation.</p>${analysis.sensitivities.slice(0, 12).map(row => `<div class="di-tornado"><span>${safe(row.label)}<small>r=${fmt(row.correlation)} · n=${row.count}</small></span><meter min="0" max="1" value="${row.magnitude}" aria-label="Association strength for ${esc(row.label)}"></meter></div>`).join("") || "<p>No varying inputs with enough successful numeric samples.</p>"}</details>
      <details data-di-section="dependence"><summary>Input-response inspection · descriptive bins vs numerical partial dependence</summary><label>Input<select data-di-control="parameter" aria-label="Dependence parameter">${(model().parameters || []).map(parameter => `<option value="${esc(parameter.id)}" ${parameter.id === parameterId ? "selected" : ""}>${safe(parameter.label)}</option>`).join("")}</select></label><p>Descriptive bins below can reflect correlated inputs. They are not partial dependence.</p>${table(["Observed input range", "Rows", "Outcome median", "P10–P90"], bins.map(bin => [`${fmt(bin.min)}–${fmt(bin.max)}`, bin.count, fmt(bin.median), `${fmt(bin.p10)}–${fmt(bin.p90)}`]))}<button data-di-action="partial" ${busy || !rows.some(row => row.scenarioId === scenarioId) ? "disabled" : ""}>Run actual numerical partial dependence · ≤40 interventions</button>${partial ? `<p>${safe(partial.method)}</p>${table(["Intervened effective input", "Executed rows", "Mean outcome", "Median outcome", "P10–P90"], partial.points.map(point => [fmt(point.value), point.count, fmt(point.mean), fmt(point.median), `${fmt(point.p10)}–${fmt(point.p90)}`]))}<small>Run IDs: ${partial.runIds.map(safe).join(", ")} · ${partial.executions} actual numerical reruns.</small>` : "<p>No numerical partial dependence has run for this selection.</p>"}<h4>Variance decomposition</h4><p>${safe(analysis.varianceDecomposition.reason)}</p></details>
      <details open data-di-section="verify"><summary>What should we verify? · low confidence × high descriptive impact</summary><p>Heuristic review priority; confidence is a source/model annotation, not a computed statistical interval.</p>${table(["Input", "Descriptive |r|", "Model confidence", "Attached sources", "Review priority"], analysis.verify.slice(0, 8).map(row => [row.label, fmt(row.magnitude), row.confidence, row.evidence.length, fmt(row.priority)]))}<a href="#trust">Inspect assumption/evidence ledger and known limitations</a></details>
      <details open data-di-section="explain"><summary>Explain a selected future · stored facts and numerical reasons</summary><p>${run ? `Stored future ${safe(run.id)} · seed ${safe(run.seed)} · model ${safe(run.modelVersion || source?.modelVersion)}` : "No stored future selected."}</p><label>Comparison future<select data-di-control="reference" aria-label="Intelligence reference future">${rows.map(row => `<option value="${esc(row.id)}" ${row.id === compared?.id ? "selected" : ""}>${safe(row.scenarioId)} · ${safe(row.id)} · seed ${safe(row.seed)}</option>`).join("")}</select></label><p>${safe(explanation.text)}</p>${table(["Recorded mechanism / numerical reason", "Value or metric delta", "Unit", "Interpretation"], explanation.reasons.map(reason => [reason.label || reason.id || reason.parameterId, fmt(reason.delta ?? reason.value), reason.unit || "", reason.kind]))}<button data-di-action="explain" ${busy || !run ? "disabled" : ""}>Compute top-five matched numerical reasons</button>${attribution ? `<p>${safe(attribution.method)} · baseline ${safe(attribution.baselineSource)} · total selected-baseline Δ ${fmt(attribution.totalDelta)} · nonadditive residual ${fmt(attribution.residual)}.</p><p>${safe(attribution.caveat)}</p>` : "<p>No numerical attribution has run for this future. Stored mechanism order is not an impact ranking.</p>"}<form data-di-query><label>Ask why / compare<textarea rows="2" maxlength="1000" aria-label="Deterministic explanation query">${safe(query)}</textarea></label><button type="submit" ${!run ? "disabled" : ""}>Inspect recorded evidence</button></form>${queryAnswer ? `<p class="di-answer">${safe(queryAnswer.text)}</p>` : ""}</details>
      <details data-di-section="xray"><summary>Causal X-Ray · interactive implemented dependencies</summary><p>${safe(housingCausalRegistry.limitation)} Select a node to highlight downstream dependencies and inspect its equations/events. Graph registry version ${safe(housingCausalRegistry.modelVersion)}; source model ${safe(run?.modelVersion || source?.modelVersion || model().version)}.${run?.modelVersion && run.modelVersion !== housingCausalRegistry.modelVersion ? " This graph is documented for the current version; legacy numerical reruns resolve the stored version, and the graph is not asserted to document legacy equations." : ""}</p>${causalGraphSvg(housingCausalRegistry, selectedNode)}<h4>Selected: ${safe(selectedNode)}</h4>${equations.map(equation => `<article class="di-equation"><strong>${safe(equation.label)}</strong><code>${safe(equation.expression)}</code><small>Source: ${safe(equation.source)} · event types: ${equation.eventTypes.map(safe).join(", ")}</small></article>`).join("") || "<p>No equation links registered for this node.</p>"}<h4>Actual selected-run events linked to these equations</h4><pre>${safe(JSON.stringify(events.slice(0, 12), null, 2))}</pre></details>
      <details data-di-section="before-after"><summary>Before / after · paired stored experiments</summary><p>${safe(comparison.reason)}</p>${comparison.available ? `<p>Source ${safe(comparison.sourceExperimentId)} → current ${safe(comparison.currentExperimentId)} · ${comparison.pairs} actual scenario/seed pairs.</p>${table(["Metric", "Median Δ", "P10–P90 Δ", "Paired rows"], comparison.metrics.map(metric => [`${metric.scenarioName} · ${metric.label} (${metric.unit})`, fmt(metric.medianDelta), `${fmt(metric.p10)}–${fmt(metric.p90)}`, metric.count]))}` : ""}</details>
      <details data-di-section="methodology"><summary>Methodology and limitations</summary><p>Quartile conditions are mined within scenarios; population support and target counts both need to pass the user-selected minima. Lift = P(target | condition) / P(target). Conjunctions use at most two distinct parameters. No statistical-significance claim or holdout validation is implied.</p><ul>${analysis.limitations.map(item => `<li>${safe(item)}</li>`).join("")}</ul><p>No automatic variance decomposition is reported. Numerical grids and one-at-a-time reversions run the versioned housing equations and preserve the recorded seed, effective conditions, projects and scheduled/fork operations.</p></details>`;
    for (const element of body.querySelectorAll("details[data-di-section]")) if (opens.has(element.dataset.diSection)) element.open = opens.get(element.dataset.diSection);
  }
  function cancel() { generation++; controller?.abort(); controller = null; busy = false; }
  async function numerical(kind) {
    if (busy || !selected()) return;
    const token = ++generation, source = experiment(), run = selected(); controller = new AbortController(); busy = true; message = "Executing the recorded version's numerical equations; source experiment remains unchanged."; render();
    try {
      if (kind === "partial") {
        const definition = (model().parameters || []).find(row => row.id === parameterId), rows = runsOf(context).filter(row => row.scenarioId === scenarioId);
        const observed = rows.map(row => ({ ...row.parameters, ...row.sampledParameters })[parameterId]).filter(value => typeof value === "number" && Number.isFinite(value));
        let min = observed.length ? Math.min(...observed) : definition.min, max = observed.length ? Math.max(...observed) : definition.max;
        if (min === max) { const spread = Math.max(definition.step || 0, (definition.max - definition.min) * 0.05); min = Math.max(definition.min, min - spread); max = Math.min(definition.max, max + spread); }
        const values = [...new Set(Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4))];
        const result = await runPartialDependence({ runs: rows, parameterId, metricId, values, signal: controller.signal, rerun: ({ run: stored, ...edit }) => { const response = runHousingCounterfactual({ run: stored, scenario: source.scenarios.find(row => row.id === stored.scenarioId), years: source.years, ...edit }); if (response.recordedMismatch?.length) throw new Error("Recorded inputs do not reproduce selected metrics; diagnostic blocked. Inspect the source manifest."); return response; }, onProgress: progress => { if (token === generation) { const status = body.querySelector(".di-status"); if (status) status.textContent = `Numerical partial dependence: ${progress.completed}/${progress.total} actual interventions.`; } } });
        if (token === generation) partial = result;
      } else {
        await new Promise(resolve => setTimeout(resolve, 0));
        const baselineScenario = source.scenarios.find(row => row.kind === "baseline"), baselineRun = runsOf(context).find(row => row.scenarioId === baselineScenario?.id && row.seed === run.seed);
        const result = explainHousingRun({ run, scenario: source.scenarios.find(row => row.id === run.scenarioId), baselineRun, baselineScenario, years: source.years, metricId });
        if (Object.entries(run.metrics || {}).some(([id, value]) => Number.isFinite(value) && result.selected.metrics[id] !== value)) throw new Error("Source reconstruction mismatches recorded outcomes; attribution blocked.");
        if (token === generation) attribution = result;
      }
      if (token === generation) message = "Numerical diagnostic complete. Effects describe the implemented model, not real-world causal proof.";
    } catch (error) { if (token === generation) message = error.message; }
    finally { if (token === generation) { busy = false; render(); } }
  }
  async function click(event) {
    const node = event.target.closest("[data-causal-node]"); if (node) { selectedNode = node.dataset.causalNode; render(); return; }
    const button = event.target.closest("[data-di-action]"); if (!button || button.disabled) return;
    try {
      if (button.dataset.diAction === "fix") { if (context.readOnly || context.busy) return; const rule = analysis.failureRules.find(row => row.id === button.dataset.rule); await onProposeEdit?.(proposeRuleFix({ rule, input: context.input, model: model() })); message = "Fix sent to approval preview. No change has been applied by intelligence."; render(); }
      if (button.dataset.diAction === "inspect-rule") { const rule = [...analysis.failureRules, ...analysis.successPatterns].find(row => row.id === button.dataset.rule && row.target === button.dataset.target); const run = runsOf(context).find(row => row.id === rule?.runIds?.[0]); if (run) onSelectRun?.(run); }
      if (["partial", "explain"].includes(button.dataset.diAction)) await numerical(button.dataset.diAction);
    } catch (error) { message = error.message; render(); }
  }
  function change(event) {
    const kind = event.target.dataset.diControl; if (!kind) return;
    cancel(); const value = event.target.value;
    if (kind === "scenario") scenarioId = value;
    if (kind === "classification") classificationMode = value;
    if (kind === "metric") metricId = value;
    if (kind === "parameter") parameterId = value;
    if (kind === "reference") referenceId = value;
    if (kind === "min-count") { if (!Number.isInteger(Number(value)) || Number(value) < 2) { message = "Minimum rule count must be a whole number ≥2."; render(); return; } minCount = Number(value); }
    if (kind === "support") { if (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 1) { message = "Support must be in (0,1]."; render(); return; } minSupport = Number(value); }
    attribution = null; partial = null; queryAnswer = null; message = ""; refresh(); render();
  }
  function submit(event) { if (!event.target.matches("[data-di-query]")) return; event.preventDefault(); query = event.target.querySelector("textarea").value; queryAnswer = queryFuture({ query, run: selected(), referenceRun: reference(), registry: housingCausalRegistry, attribution, metricId }); render(); }
  const keydown = event => { if (event.target.matches("[data-causal-node]") && ["Enter", " "].includes(event.key)) { event.preventDefault(); selectedNode = event.target.dataset.causalNode; render(); } };
  root.addEventListener("click", click); root.addEventListener("change", change); root.addEventListener("submit", submit); root.addEventListener("keydown", keydown);
  render();
  return { update(next = {}) {
    if (destroyed) return;
    const key = `${experimentOf(next)?.id || "draft"}:${next.selectedRun?.id || ""}:${experimentOf(next)?.modelVersion || ""}`;
    if (sourceKey !== key) { cancel(); attribution = null; partial = null; queryAnswer = null; message = ""; sourceKey = key; }
    context = next;
    if (!experiment()?.scenarios?.some(row => row.id === scenarioId)) scenarioId = experiment()?.scenarios?.find(row => row.kind !== "baseline")?.id || experiment()?.scenarios?.[0]?.id || "";
    if (!(model().metrics || []).some(row => row.id === metricId)) metricId = model().metrics?.[0]?.id || "";
    if (!(model().parameters || []).some(row => row.id === parameterId)) parameterId = model().parameters?.[0]?.id || "";
    refresh(); render();
  }, destroy() { destroyed = true; cancel(); root.removeEventListener("click", click); root.removeEventListener("change", change); root.removeEventListener("submit", submit); root.removeEventListener("keydown", keydown); root.remove(); } };
}
