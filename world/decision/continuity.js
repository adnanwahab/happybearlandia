import { contextFromURL, contextURL } from '../universe/navigation.js';
import { canonicalId, parseCanonicalId, NavigationContextSchema } from '../../shared/causality/index.js';

export const CONTINUITY_VERSION = 'decision-continuity.v1';
export function readContinuity(url) {
  return contextFromURL(url);
}
export function localContextId(value, kind, namespace) {
  if (!value) return null;
  const parsed = parseCanonicalId(value);
  return parsed.kind === kind && parsed.namespace === namespace ? parsed.localId : null;
}
/** Add native record identity without changing the originating world or selected entity. */
export function recordContext(context, { namespace, experimentId, runId, scenarioId, branchId, tick } = {}) {
  const next = { ...NavigationContextSchema.parse(context) };
  // A different experiment invalidates the previous run/branch selection.
  if (experimentId) {
    const id = canonicalId('experiment', namespace, experimentId);
    if (next.experimentId !== id) { delete next.runId; delete next.branchId; delete next.tick; }
    next.experimentId = id;
  }
  if (runId && !experimentId && next.experimentId && parseCanonicalId(next.experimentId).namespace !== namespace) { delete next.experimentId; delete next.runId; delete next.branchId; delete next.tick; }
  if (scenarioId) next.scenarioId = canonicalId('scenario', namespace, scenarioId);
  if (runId) {
    const id = canonicalId('run', namespace, runId);
    if (next.runId !== id) { delete next.branchId; delete next.tick; }
    next.runId = id;
  }
  if (branchId) next.branchId = canonicalId('branch', namespace, branchId);
  if (tick !== undefined) next.tick = tick;
  return NavigationContextSchema.parse(next);
}
export function continuityLink(route, context, origin = 'http://localhost') {
  const url = new URL(route, origin);
  if (url.origin !== new URL(origin).origin) throw new Error('Continuity links must stay in this world origin');
  const contextual = new URL(contextURL(url.pathname + url.search + url.hash, context), origin);
  url.search = contextual.search;
  // Only the owning experience may interpret its native experiment identifiers.
  const decision = url.pathname === '/world/decision.html';
  const lab = url.pathname === '/world/experiment-lab.html';
  const experiment = localContextId(context.experimentId, 'experiment', decision ? 'decision' : 'civic');
  if ((decision || lab) && !experiment) {
    for (const key of ['experiment', 'run', 'month', 'demo']) url.searchParams.delete(key);
  }
  if ((decision || lab) && experiment) {
    url.searchParams.delete('demo'); url.searchParams.set('experiment', experiment);
    const run = localContextId(context.runId, 'run', decision ? 'decision' : 'civic');
    url.searchParams.delete('run'); url.searchParams.delete('month');
    if (run) url.searchParams.set('run', run);
    if (decision && context.tick !== undefined) url.searchParams.set('month', String(context.tick));
  }
  return url.pathname + url.search + url.hash;
}
/** Native model inputs remain native. No lexical policy-to-housing conversion. */
export function decisionSnapshot({ experiment, runs = [], model, job, selectedRun } = {}) {
  return {
    schemaVersion: CONTINUITY_VERSION, evidence: 'synthetic', worldMutation: false,
    model: { id: experiment?.modelId ?? model?.id ?? null, version: experiment?.modelVersion ?? model?.version ?? null },
    assumptions: (experiment?.scenarios || []).map(s => ({ scenarioId: s.id, parameters: s.parameters, uncertainty: s.uncertainty })),
    objectives: job?.config?.objectives ?? experiment?.metadata?.successCriteria ?? [],
    constraints: job?.config?.constraints ?? [],
    results: selectedRun ? [{ id: selectedRun.id, status: selectedRun.status, metrics: selectedRun.metrics }] : runs.map(r => ({ id: r.id, status: r.status, metrics: r.metrics })),
    optimization: job ? { id: job.id, status: job.status, pareto: job.pareto || [], alternatives: job.candidates || [] } : null,
    lineage: selectedRun?.lineage ?? experiment?.metadata?.selectedFutureFork ?? null,
  };
}

export function pairedSnapshot({ result, selected, program, plan, tests, analysis } = {}) {
  const manifest = result?.manifest;
  return { schemaVersion: CONTINUITY_VERSION, evidence: 'synthetic', worldMutation: false,
    model: { version: manifest?.modelVersion ?? null, runtime: manifest?.runtimeVersion ?? null },
    assumptions: manifest?.assumptions ?? program?.assumptions ?? [],
    objectives: program?.objectives ?? [], constraints: tests ?? manifest?.tests ?? [],
    reviewedPolicy: plan?.clauses?.map(c => ({ id: c.id, supported: c.supported, mapping: c.mapping, limitations: c.limitations })) ?? null,
    unsupported: program?.unsupported ?? [],
    results: selected ?? result?.summary ?? (result ? { status: result.status, runs: result.runs } : null), analysis: analysis ?? null,
    source: plan?.provenance ?? null,
    persistence: manifest && !manifest.id ? 'This catalog has no saved experiment ID. Context links retain selection but cannot reconstruct this catalog; use its native export.' : null,
  };
}
