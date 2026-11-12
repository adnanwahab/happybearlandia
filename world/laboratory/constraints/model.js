import { sameRun } from '../../../shared/causality/index.js';
import { loadAuditRun } from '../../civilization/debugger/model.js';

export const RULES_VERSION = 'city-constraints.v1';
export const categories = Object.freeze({
  construction: 'Construction resources',
  materials: 'Materials',
  weather: 'Weather',
  permits: 'Permits',
  utilities: 'Utility capacity',
  budget: 'Budget and financing',
  staffing: 'Administrative staffing',
  transport: 'Job access',
  unclassified: 'Unclassified delay',
});

const constructionReasons = new Map([
  ['contractors', ['construction', 'Contractor capacity']],
  ['labor', ['construction', 'Labor capacity']],
  ['equipment', ['construction', 'Equipment capacity']],
  ['weather', ['weather', 'Weather interruption']],
  ['permit delay', ['permits', 'Permit capacity']],
  ['utility capacity', ['utilities', 'Utility headroom for housing']],
  ['financing', ['budget', 'Financing delay']],
]);

function constraintLabel(eventType, system, reason) {
  if (system === 'construction') {
    if (eventType === 'MATERIAL_DELAY') return reason === 'materials'
      ? ['materials', 'Material capacity'] : ['unclassified', 'Construction delay'];
    if (eventType === 'CAPACITY_DELAY') return constructionReasons.get(reason) ??
      ['unclassified', 'Construction delay'];
  }
  if (system === 'governance' && eventType === 'IMPLEMENTATION_DELAY' && reason === 'staffing') {
    return ['staffing', 'Policy implementation staffing'];
  }
  if (system === 'finance' && eventType === 'CAPITAL_PROJECT_DELAYED') {
    return ['budget', 'Capital project funding'];
  }
  if (system === 'utilities' && eventType === 'UTILITY_CAPACITY_FAILURE') {
    return ['utilities', 'Utility service shortfall'];
  }
  if (system === 'transport' && eventType === 'UNREACHABLE_JOB') {
    return ['transport', 'Assigned job recorded as unreachable'];
  }
  return null;
}

export function classifyConstraint(event) {
  const source = event.payload?.source;
  if (event.provenance?.kind !== 'simulated' || !source || source.eventType !== event.type ||
      source.simulationTime !== event.context?.tick ||
      source.modelVersion !== event.context.modelVersion) return null;
  const { payload, system, geographyId } = source;
  const label = constraintLabel(event.type, system, payload?.reason);
  if (!label) return null;
  const [category, title] = label;
  const { universeId, worldId, scenarioId, runId, tick } = event.context;
  return {
    id: event.id,
    category,
    title,
    sourceType: event.type,
    district: geographyId,
    subject: payload?.projectId ?? payload?.policyId ?? payload?.utility ?? payload?.workerId ?? null,
    reason: typeof payload?.reason === 'string' ? payload.reason : null,
    progress: Number.isFinite(payload?.progressFraction) ? payload.progressFraction : null,
    evidenceLink: '/world/causality/inspect.html?' + new URLSearchParams({
      universeId, worldId, scenarioId, runId, tick, targetId: event.id,
    }),
    replayLink: '/world/causal.html?' + new URLSearchParams({ runId, month: tick, event: event.id }),
  };
}

export async function loadConstraintRun(runId, fetcher = fetch) {
  const run = await loadAuditRun(runId, fetcher);
  if (run.state !== 'ready') return run;

  const findings = new Map();
  const query = new URLSearchParams({ runId: run.context.runId, limit: 250 });
  let cursor = -1;
  while (true) {
    const response = await fetcher('/api/causality/events?' + query);
    if (!response.ok) throw new Error(`The retained event feed could not be loaded (HTTP ${response.status}).`);
    const { items, nextCursor } = await response.json();
    for (const event of items) {
      const context = event.context;
      if (!context || !sameRun(context, run.context) || !run.checkpoints.has(context.tick)) continue;
      const finding = classifyConstraint(event);
      if (!finding) continue;
      if (!findings.has(context.tick)) findings.set(context.tick, []);
      findings.get(context.tick).push(finding);
    }
    if (nextCursor === null) break;
    if (!Number.isSafeInteger(nextCursor) || nextCursor <= cursor) throw new Error('The event cursor did not advance.');
    cursor = nextCursor;
    query.set('afterSequence', String(cursor));
  }
  return { ...run, findings };
}

export function constraintsAtMonth(run, month) {
  if (run.state !== 'ready' || !run.checkpoints.has(month)) return { state: 'unavailable' };
  const findings = run.findings.get(month) ?? [];
  const counts = Object.fromEntries(Object.keys(categories).map(key => [key, 0]));
  for (const finding of findings) counts[finding.category]++;
  return { state: 'ready', findings, counts };
}
