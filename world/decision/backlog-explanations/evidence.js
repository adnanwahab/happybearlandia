import { queryFuture } from '../intelligence.js';
const finite = Number.isFinite;
const clock = row => finite(row?.month) && row.month >= 0 ? row.month : row?.month === undefined && finite(row?.year) && row.year >= 0 ? row.year * 12 : null;
const validMonth = month => month === Infinity || (Number.isInteger(month) && month >= 0);
const snapshots = run => run?.monthlyTimeline?.length ? run.monthlyTimeline : run?.timeline || [];
const checkpoint = (run, month) => { const rows = snapshots(run).filter(row => clock(row) === month); return rows.length === 1 ? rows[0].metrics : null; };
const horizon = run => { const dates = snapshots(run).map(clock); return dates.length && dates.every(v => v !== null) && new Set(dates).size === dates.length ? Math.max(...dates) : null; };
export function recordedRipple({ run, registry, month = Infinity, nodeId } = {}) {
  if (!validMonth(month)) return { available: false, reason: 'Select a nonnegative integer month.', frames: [], edges: [] };
  if (!run || run.status !== 'completed' || !run.modelVersion || registry?.modelVersion !== run.modelVersion) return { available: false, reason: 'A completed run and version-matched registry are required.', frames: [], edges: [] };
  const equations = new Map((registry.equations || []).map(e => [e.id, e]));
  const edges = (registry.edges || []).filter(e => equations.has(e.equationId));
  const reached = new Set(nodeId ? [nodeId] : []);
  for (let i = 0; i < edges.length; i++) for (const e of edges) if (reached.has(e.from)) reached.add(e.to);
  const supported = nodeId ? edges.filter(e => reached.has(e.from)) : edges;
  const frames = (run.events || []).map((event, index) => ({ event, index, month: clock(event) }))
    .filter(row => row.month !== null && row.month <= month).sort((a, b) => a.month - b.month || a.index - b.index)
    .map(row => ({ ...row, reference: { runId: run.id, eventIndex: row.index }, edges: supported.filter(e => equations.get(e.equationId).eventTypes?.includes(row.event.type)).map(e => ({ ...e, evidenceKind: 'registered-rule-event-association' })) }));
  return { available: true, runId: run.id, seed: run.seed, modelVersion: run.modelVersion, registryId: registry.id, frames, edges: supported, omittedUndatedEvents: (run.events || []).filter(e => clock(e) === null).length, limitation: 'Playback shows recorded event times and registered rule associations. It does not infer event-to-event causal edges or propagation delays. Registry edges describe programmed dependencies, not empirical causation.' };
}

/** Bounded natural-language intent/metric resolver. All numeric answers use stored rows. */
export function answerEvidence({ query = '', run, referenceRun, registry, model, month = Infinity } = {}) {
  if (!validMonth(month)) return { kind: 'unavailable', text: 'Select a nonnegative integer month.' };
  if (query.length > 1000) return { kind: 'unsupported', text: 'Use a question of at most 1000 characters.' };
  const compare = /what.*chang|compar|differ|between/i.test(query);
  const why = /why|reason|explain|happen/i.test(query);
  if (!compare && !why) return queryFuture({ query, run });
  if (!run || run.status !== 'completed') return { kind: 'unavailable', text: 'Select a completed recorded future.' };
  const normalized = query.toLowerCase().replace(/[_-]/g, ' ');
  const metrics = (model?.metrics || []).filter(m => [m.id.replace(/_/g, ' '), m.label?.toLowerCase()].filter(Boolean).some(name => normalized.includes(name)));
  if (metrics.length > 1) return { kind: 'ambiguous', text: 'Ask about one metric at a time.', metricIds: metrics.map(m => m.id) };
  const metric = metrics[0];
  if (!metric) return { kind: 'clarify', text: 'Name a supported metric, such as median rent or housing supply.', metricIds: (model?.metrics || []).map(m => m.id) };
  const selected = month === Infinity ? run.metrics : checkpoint(run, month);
  if (!finite(selected?.[metric.id])) return { kind: 'unavailable', text: 'The selected metric/checkpoint is missing; no interpolation was made.' };
  const provenance = { runId: run.id, seed: run.seed, modelVersion: run.modelVersion, month: month === Infinity ? null : month, metricId: metric.id, unit: metric.unit };
  if (compare) {
    if (!referenceRun || referenceRun.status !== 'completed' || !run.experimentId || run.experimentId !== referenceRun.experimentId || !run.engineVersion || run.engineVersion !== referenceRun.engineVersion || !run.modelVersion || run.modelVersion !== referenceRun.modelVersion || (model?.version && model.version !== run.modelVersion) || !finite(run.seed) || run.seed !== referenceRun.seed || horizon(run) === null || horizon(run) !== horizon(referenceRun)) return { kind: 'unavailable', text: 'Comparison requires completed futures from the same recorded experiment/engine authority, seed, model version and horizon.' };
    const reference = month === Infinity ? referenceRun.metrics : checkpoint(referenceRun, month);
    if (!finite(reference?.[metric.id])) return { kind: 'unavailable', text: 'Reference metric/checkpoint is missing.' };
    const value = selected[metric.id], previous = reference[metric.id];
    return { kind: 'compare', provenance, referenceRunId: referenceRun.id, value, referenceValue: previous, delta: value - previous, text: `${metric.label}: ${value} vs ${previous} ${metric.unit}; change ${value - previous}. Same-seed modeled comparison; numerical difference is not causal attribution.` };
  }
  const ripple = recordedRipple({ run, registry, month });
  const incoming = ripple.available ? ripple.edges.filter(e => e.to === metric.id) : [];
  const equationIds = new Set(incoming.map(e => e.equationId));
  const equations = (registry?.equations || []).filter(e => equationIds.has(e.id));
  const events = ripple.frames.filter(f => f.edges.some(e => equationIds.has(e.equationId)));
  const drivers = (run.drivers || []).filter(d => d.metricId === metric.id && finite(d.value));
  return { kind: 'why', provenance, value: selected[metric.id], equations, events, drivers: month === Infinity ? drivers : [], text: `${metric.label} is recorded as ${selected[metric.id]} ${metric.unit}. ${equations.length} version-matched programmed rules and ${events.length} dated event records support inspection. ${month === Infinity ? drivers.length : 0} recorded metric-specific mechanisms. These records do not measure causal contributions.${!ripple.available ? ' Rule links unavailable: model version mismatch.' : ''}` };
}
