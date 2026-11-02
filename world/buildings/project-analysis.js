/** Read-only project/report contract.
 * analyzeBuildingProjects({experiment,runs,model,baselineScenarioId?}) consumes
 * BuildingProposal inputs and STORED successful run.projects[].states/events.
 * It never runs a counterfactual, approves an edit, changes inputs or invents
 * construction states. Month percentiles condition on completion in the horizon;
 * unresolved projects are censored, not assigned an artificial completion date.
 */
const numeric = value => typeof value === "number" && Number.isFinite(value);
const nonnegative = value => numeric(value) && value >= 0;
const successful = run => ["completed", "successful", "succeeded"].includes(run?.status);
const copy = value => value === undefined ? null : structuredClone(value);
const completedStatuses = new Set(["complete", "completed", "occupied"]);

export function summarizeProjectValues(input = []) {
  const values = input.filter(numeric).sort((a, b) => a - b);
  if (!values.length) return { count: 0, mean: null, median: null, p10: null, p90: null, min: null, max: null };
  const q = probability => { const index = (values.length - 1) * probability, lower = Math.floor(index); return values[lower] + (values[Math.ceil(index)] - values[lower]) * (index - lower); };
  return { count: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length, median: q(0.5), p10: q(0.1), p90: q(0.9), min: values[0], max: values.at(-1) };
}

function summaryFromStates(project, states, events) {
  const finalState = states.at(-1), proposal = project.proposal;
  const completed = states.find(state => completedStatuses.has(state.status) || (numeric(proposal?.program?.residentialUnits) && proposal.program.residentialUnits > 0 && numeric(state.completedUnits) && state.completedUnits >= proposal.program.residentialUnits));
  const cancellation = states.find(state => state.status === "cancelled");
  const occupancy = states.find(state => state.status === "occupied" || numeric(state.occupiedUnits) && state.occupiedUnits > 0);
  return { schemaVersion: "project-trace-summary.v1", source: "stored-monthly-states", stateCount: states.length, initialStatus: states[0].status, endMonth: finalState.month, finalState: copy(finalState), completionMonth: completed?.month ?? null, cancellationMonth: cancellation?.month ?? null, firstOccupiedMonth: occupancy?.month ?? null, capacityBottleneck: events.some(isCapacityEvent) || states.some(state => numeric(state.capacityShortfall) && state.capacityShortfall > 0), capacityEvents: copy(events.filter(isCapacityEvent).slice(0, 8)) };
}
/** Engine projection helper: compact analysis facts, never a synthetic replay.
 * The caller retains complete server states and marks the project projection.
 */
export function summarizeStoredProject(project) {
  if (project?.projection === "summary") return project.summary?.schemaVersion === "project-trace-summary.v1" ? copy(project.summary) : null;
  const states = (Array.isArray(project?.states) ? project.states : []).filter(state => numeric(state.month) && state.month >= 0).toSorted((a, b) => a.month - b.month);
  if (!states.length) return null;
  return summaryFromStates(project, states, Array.isArray(project.events) ? project.events : []);
}
export function storedProjectTrace(run, projectId) {
  const project = (Array.isArray(run?.projects) ? run.projects : []).find(record => (record.projectId ?? record.id) === projectId);
  if (!project) return null;
  const events = [...(Array.isArray(project.events) ? project.events : []), ...(Array.isArray(run.events) ? run.events.filter(event => event.projectId === projectId) : [])];
  const unique = [...new Map(events.map(event => [JSON.stringify(event), event])).values()];
  if (project.projection !== "summary" && run.traceDelivery !== "on-demand" && Array.isArray(project.states) && project.states.length) {
    const states = project.states.filter(state => numeric(state.month) && state.month >= 0).toSorted((a, b) => a.month - b.month);
    if (!states.length) return null;
    return { projectId, states, final: states.at(-1), events: unique, projection: "full", summary: summaryFromStates(project, states, unique) };
  }
  const summary = project.summary;
  const validMonth = value => value === null || numeric(value) && value >= 0 && value <= summary.endMonth;
  if ((project.projection !== "summary" && run.traceDelivery !== "on-demand") || summary?.schemaVersion !== "project-trace-summary.v1" || !numeric(summary.endMonth) || !summary.finalState || summary.finalState.month !== summary.endMonth || typeof summary.initialStatus !== "string" || ![summary.completionMonth, summary.cancellationMonth, summary.firstOccupiedMonth].every(validMonth) || typeof summary.capacityBottleneck !== "boolean") return null;
  return { projectId, states: null, final: summary.finalState, events: [...new Map([...unique, ...(summary.capacityEvents || [])].map(event => [JSON.stringify(event), event])).values()], projection: "summary", summary };
}

function isCapacityEvent(event) {
  const content = `${event.type || ""} ${event.cause || ""} ${event.reason || ""} ${event.message || ""} ${event.label || ""}`;
  return /capacity|workforce.shortage|construction.shortage/i.test(content) && /delay|shortage|bound|constraint|exhaust|shortfall|limited|postpon/i.test(content);
}
function completionState(trace) {
  return trace.summary.completionMonth === null ? null : { month: trace.summary.completionMonth };
}

function readFinal(trace, keys) {
  for (const key of keys) if (nonnegative(trace.final[key])) return trace.final[key];
  return null;
}
function totalsForRun(run, proposals, getTrace = storedProjectTrace) {
  if (!proposals.length) return { directUnits: 0, publicCost: 0 };
  const traces = proposals.map(project => getTrace(run, project.id));
  if (traces.some(trace => !trace)) return null;
  const units = traces.map(trace => readFinal(trace, ["completedUnits"]));
  const costs = traces.map(trace => readFinal(trace, ["publicCost"]));
  return { directUnits: units.every(numeric) ? units.reduce((sum, value) => sum + value, 0) : null, publicCost: costs.every(numeric) ? costs.reduce((sum, value) => sum + value, 0) : null };
}

/** Recorded provenance, never an assertion of cryptographic audit verification. */
export function worldEditProvenance(metadata = {}) {
  const history = Array.isArray(metadata.worldEditHistory) ? metadata.worldEditHistory : [];
  const records = history.map(entry => {
    const source = entry?.audit || entry || {};
    const revision = entry?.revision || {};
    return { id: source.editId || source.id || revision.id || null, revisionId: source.newRevision || source.revisionId || revision.id || source.id || null, parent: source.previousRevision || source.parent || source.parentRevision || revision.parent || null, prompt: source.prompt ?? revision.prompt ?? null, provider: source.provider ?? revision.provider ?? null, model: source.model ?? revision.model ?? null, proposalHash: source.proposalHash || revision.proposalHash || null, operations: copy(source.operations ?? revision.operations ?? []), approved: source.approved === true || source.approved !== false && Boolean(source.approvedAt ?? revision.approvedAt), approvalEvidence: source.approved === true ? "explicit flag" : source.approvedAt || revision.approvedAt ? "revision approval timestamp" : "not recorded", summary: source.summary ?? revision.summary ?? null, restoredFrom: source.restoredFrom ?? revision.restoredFrom ?? null, approvedAt: source.approvedAt ?? revision.approvedAt ?? null, requiresSimulationRerun: source.requiresSimulationRerun ?? revision.requiresSimulationRerun ?? null, kind: source.kind || source.type || revision.kind || "approved edit record" };
  });
  return { currentRevision: copy(metadata.worldRevision), resultsSourceExperimentId: typeof metadata.resultsSourceExperimentId === "string" ? metadata.resultsSourceExperimentId : null, records, notice: "Recorded provider, model, prompt, operations, approval timestamp and proposal hash are reported verbatim. This view does not independently verify hashes or establish that a provider's assumptions are true." };
}

export function analyzeSuccessCriteria({ experiment, runs = [] } = {}) {
  return (experiment?.scenarios || []).map(scenario => {
    const criterion = scenario.successCriterion;
    if (!criterion) return { scenarioId: scenario.id, scenarioName: scenario.name || scenario.id, status: "not-defined", criterion: null, count: 0, successful: 0, share: null };
    const valid = typeof criterion.metricId === "string" && ["gte", "lte"].includes(criterion.operator) && numeric(criterion.value);
    const group = runs.filter(run => successful(run) && run.scenarioId === scenario.id);
    const observed = valid ? group.filter(run => numeric(run.metrics?.[criterion.metricId])) : [];
    const passed = observed.filter(run => criterion.operator === "gte" ? run.metrics[criterion.metricId] >= criterion.value : run.metrics[criterion.metricId] <= criterion.value);
    return { scenarioId: scenario.id, scenarioName: scenario.name || scenario.id, criterion: copy(criterion), status: !valid ? "invalid" : observed.length ? "observed" : "awaiting-results", count: observed.length, successful: passed.length, missing: group.length - observed.length, share: observed.length ? passed.length / observed.length : null, runIds: passed.map(run => run.id), interpretation: "Share of successful stored runs meeting the explicitly recorded final-outcome threshold; conditional on chosen input distributions, not a forecast probability." };
  });
}

export function analyzeBuildingProjects({ experiment, runs = [], model = {}, baselineScenarioId } = {}) {
  const scenarios = experiment?.scenarios || [], rows = runs.filter(successful);
  const baseline = scenarios.find(scenario => scenario.id === baselineScenarioId) || scenarios.find(scenario => scenario.kind === "baseline") || scenarios[0];
  const baselineRuns = new Map(rows.filter(run => run.scenarioId === baseline?.id).map(run => [run.seed, run]));
  const projects = [], scenarioSummaries = [], traceCache = new Map();
  const getTrace = (run, id) => { if (!traceCache.has(run)) traceCache.set(run, new Map()); const cache = traceCache.get(run); if (!cache.has(id)) cache.set(id, storedProjectTrace(run, id)); return cache.get(id); };
  for (const scenario of scenarios) {
    const group = rows.filter(run => run.scenarioId === scenario.id);
    const proposals = Array.isArray(scenario.projects) ? scenario.projects : [];
    for (const proposal of proposals) {
      const observed = group.map(run => ({ run, trace: getTrace(run, proposal.id) })).filter(record => record.trace);
      const eligible = observed.filter(record => !["proposed", "cancelled"].includes(record.trace.summary.initialStatus));
      const completed = eligible.map(record => ({ ...record, completion: completionState(record.trace, proposal) })).filter(record => record.completion);
      const occupied = eligible.filter(record => record.trace.summary.firstOccupiedMonth !== null);
      const cancelled = eligible.filter(record => record.trace.summary.cancellationMonth !== null);
      const capacity = observed.filter(record => record.trace.summary.capacityBottleneck);
      const resolvedIds = new Set([...completed, ...cancelled].map(record => record.run.id));
      const deadline = numeric(proposal.construction?.permitMonths) && numeric(proposal.construction?.buildMonths) ? proposal.construction.permitMonths + proposal.construction.buildMonths : null;
      projects.push({ scenarioId: scenario.id, scenarioName: scenario.name || scenario.id, projectId: proposal.id, name: proposal.name || proposal.id, inputStatus: proposal.status, input: copy(proposal), successfulRuns: group.length, eligibleRuns: eligible.length, observedRuns: observed.length, fullTraceRuns: observed.filter(record => record.trace.projection === "full").length, summaryRuns: observed.filter(record => record.trace.projection === "summary").length, missingTraces: group.length - observed.length,
        plannedUnits: numeric(proposal.program?.residentialUnits) ? proposal.program.residentialUnits : null, plannedAffordableUnits: numeric(proposal.program?.affordableUnits) ? proposal.program.affordableUnits : null, estimatedTotalCost: numeric(proposal.finance?.estimatedCost) ? proposal.finance.estimatedCost : null, authorizedPublicSubsidy: numeric(proposal.finance?.publicSubsidy) ? proposal.finance.publicSubsidy : null, plannedCompletionMonth: deadline,
        completionCount: completed.length, completionProbability: eligible.length ? completed.length / eligible.length : null, cancellationCount: cancelled.length, cancellationProbability: eligible.length ? cancelled.length / eligible.length : null, occupancyCount: occupied.length, occupancyProbability: eligible.length ? occupied.length / eligible.length : null, unresolvedCount: eligible.length - resolvedIds.size,
        completionMonths: summarizeProjectValues(completed.map(record => record.completion.month)), delayMonths: summarizeProjectValues(deadline === null ? [] : completed.map(record => record.completion.month - deadline)), directCompletedUnits: summarizeProjectValues(observed.map(record => readFinal(record.trace, ["completedUnits"]))), directAffordableUnits: summarizeProjectValues(observed.map(record => readFinal(record.trace, ["affordableUnits", "completedAffordableUnits"]))), capacityUsed: summarizeProjectValues(observed.map(record => readFinal(record.trace, ["cumulativeCapacityUsed"]))), actualPrivateCost: summarizeProjectValues(observed.map(record => readFinal(record.trace, ["privateCost"]))), occupiedUnits: summarizeProjectValues(observed.map(record => readFinal(record.trace, ["occupiedUnits"]))), actualPublicCost: summarizeProjectValues(observed.map(record => readFinal(record.trace, ["publicCost"]))), actualTotalCost: summarizeProjectValues(observed.map(record => readFinal(record.trace, ["totalCost", "actualTotalCost"]))),
        capacityBottleneck: { count: capacity.length, denominator: observed.length, prevalence: observed.length ? capacity.length / observed.length : null, traces: capacity.slice(0, 8).map(record => ({ runId: record.run.id, seed: record.run.seed, events: copy(record.trace.events.filter(isCapacityEvent).slice(0, 6)) })) },
        storedTraces: observed.slice(0, 6).map(record => ({ runId: record.run.id, seed: record.run.seed, projection: record.trace.projection, completionMonth: record.trace.summary.completionMonth, lastMonth: record.trace.final.month, status: record.trace.final.status, events: copy(record.trace.events.slice(-8)) })),
        interpretation: "Completion/cancellation frequencies use only initially active runs with stored traces and the recorded horizon; proposed and pre-cancelled input projects are excluded from risk denominators. Timing intervals condition on completion; incomplete projects are right-censored. Explicit compact summaries retain observed timing and final-state facts; they are not full replay traces. Missing analysis facts are not treated as zero construction or censored completion.",
      });
    }
    const totals = group.map(run => totalsForRun(run, proposals, getTrace));
    const matched = scenario.id === baseline?.id ? [] : group.flatMap(run => {
      const reference = baselineRuns.get(run.seed);
      if (!reference || !numeric(run.metrics?.housing_supply) || !numeric(reference.metrics?.housing_supply)) return [];
      const treatmentTotals = totalsForRun(run, proposals, getTrace), baselineTotals = totalsForRun(reference, baseline.projects || [], getTrace);
      const totalDelta = run.metrics.housing_supply - reference.metrics.housing_supply;
      const directDelta = treatmentTotals && baselineTotals && numeric(treatmentTotals.directUnits) && numeric(baselineTotals.directUnits) ? treatmentTotals.directUnits - baselineTotals.directUnits : null;
      return [{ seed: run.seed, runId: run.id, baselineRunId: reference.id, housingDelta: totalDelta, directProjectDelta: directDelta, remainingStockDelta: numeric(directDelta) ? totalDelta - directDelta : null }];
    });
    scenarioSummaries.push({ scenarioId: scenario.id, scenarioName: scenario.name || scenario.id, projectCount: proposals.length, systemicPolicy: copy(scenario.parameters || {}), stressPresets: copy(scenario.stressPresets || []), scheduledStress: copy(scenario.scheduledStress || []), worldVisuals: copy(scenario.worldVisuals || {}), directCompletedUnits: summarizeProjectValues(totals.map(total => total?.directUnits)), actualPublicCost: summarizeProjectValues(totals.map(total => total?.publicCost)), baselineScenarioId: baseline?.id || null, pairedCount: matched.length, housingDelta: summarizeProjectValues(matched.map(row => row.housingDelta)), directProjectDelta: summarizeProjectValues(matched.map(row => row.directProjectDelta)), remainingStockDelta: summarizeProjectValues(matched.map(row => row.remainingStockDelta)), comparisonMethod: "Same-seed scenario differences. Direct units come from stored project completions; the remaining stock difference is a descriptive residual, not an isolated indirect/causal project effect. Policy, capacity crowd-out, demolitions and other modeled dynamics may all differ.", matchedRuns: matched.map(row => ({ ...row })) });
  }
  return { schemaVersion: "building-project-analysis.v1", modelVersion: experiment?.modelVersion || model.version || null, horizonMonths: numeric(experiment?.years) ? experiment.years * 12 : null, projects, scenarios: scenarioSummaries, successCriteria: analyzeSuccessCriteria({ experiment, runs }), editAudit: worldEditProvenance({ ...experiment?.metadata, resultsSourceExperimentId: experiment?.metadata?.resultsSourceExperimentId || experiment?.resultsSourceExperimentId }), limitations: ["Specific projects and systemic policy are separate inputs. A scenario difference does not isolate a building's causal effect unless the compared inputs and stochastic design support that comparison.", "Completion percentiles exclude unresolved/cancelled futures and can look optimistic when many projects remain unfinished; inspect completion share and censoring alongside timing.", "Estimated total development cost, authorized public subsidy, realized public spending and observed total spending are distinct. Unrecorded realized cost is unavailable, not the estimate.", "Visual-only edits do not alter model mathematics or seeds. Stored project states, not rendering geometry, determine delivered units and spending.", "Model/version, source dates and approval provenance must travel with a result. AI proposals and hashes are recorded claims, not evidence of empirical validity."] };
}

export const analyzeProjects = analyzeBuildingProjects;
