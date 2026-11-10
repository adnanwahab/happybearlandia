import { canonicalId, RunContextSchema } from '../../../shared/causality/index.js';
import { simulatePeriod } from './index.js';

/** Pure transition boundary; callers retain upstream observation IDs for causal joins. */
export function advanceConnectedBusiness(state, plan, { context, entityId, externalInputs = {}, sourceIds = [] }) {
  const result = simulatePeriod(state, plan, { externalInputs });
  context = RunContextSchema.parse({ ...context, tick: result.state.period });
  const key = `${context.runId}:${context.tick}:${entityId}`;
  const provenance = { id: canonicalId('provenance', 'business', key), kind: 'simulated', source: 'business-v1', modelVersion: '1.0.0', sourceIds };
  const units = { inventory: 'count', revenue: 'USD', cash: 'USD', operatingHours: 'hours' };
  const observations = Object.entries(units).map(([metric, unit]) => ({ id: canonicalId('observation', 'business', `${key}:${metric}`), context, sequence: context.tick, entityId, metricId: canonicalId('metric', 'business', metric), value: result.report[metric], unit, provenance }));
  const edges = sourceIds.flatMap(fromId => observations.map(observation => ({ id: canonicalId('edge', 'business', `${fromId}:${observation.id}`), context, fromId, toId: observation.id, relation: 'contributes', confidence: 1, evidenceIds: [fromId], provenance })));
  return { ...result, employment: { ...result.report.employment, context, entityId, provenance }, snapshot: { context, events: [], observations, assumptions: [], edges } };
}
