import { sameRun } from '../../../shared/causality/index.js';
import { demoRunId } from '../../causal/demo.js';
import { CONTRACTS, VERSION, validateState } from '../../city/contracts.js';

export const AUDIT_VERSION = 'city-integrity.v1';

export function auditCityCheckpoint(state) {
  const checks = [];
  try {
    validateState(state);
    checks.push({ name: 'CityState contract', issues: [] });
  } catch (error) {
    checks.push({ name: 'CityState contract', issues: [error.message] });
    return { checks, scarcity: null };
  }

  const households = new Set(state.households.map(row => row.id));
  const employers = new Set(state.businesses.map(row => row.id));
  checks.push({
    name: 'Worker households',
    issues: state.workers.filter(worker => !households.has(worker.householdId))
      .map(worker => `${worker.id} refers to a missing household (${worker.householdId ?? 'unspecified'}).`),
  }, {
    name: 'Job employers',
    issues: state.jobs.filter(job => !employers.has(job.businessId))
      .map(job => `${job.id} refers to a missing business (${job.businessId ?? 'unspecified'}).`),
  }, {
    name: 'Resource flow records',
    issues: Array.isArray(state.flows) ? state.flows.flatMap((flow, index) => {
      if (flow?.schemaVersion !== CONTRACTS.ResourceFlow) return [`Flow ${index + 1} has an unsupported record version.`];
      const issues = [];
      if (flow.time !== state.month) issues.push(`Flow ${index + 1} is outside the checkpoint month.`);
      if (!Number.isFinite(flow.amount) || flow.amount < 0) {
        issues.push(`Flow ${index + 1} has an invalid amount.`);
      }
      return issues;
    }) : ['Monthly resource flow records are missing.'],
  });

  const observedScarcity = [
    ['Households without an assigned home', state.households.filter(household => !household.unitId).length],
    ['Available workers without an assigned job', state.workers.filter(worker => worker.available && !worker.jobId).length],
  ];
  const scarcity = observedScarcity.map(([name, count]) => ({ name, count }));
  if (state.month > 0) {
    const utilityReadings = state.utilities.filter(utility => Number.isFinite(utility.serviceLevel));
    const facilityReadings = state.facilities.filter(facility => Number.isFinite(facility.utilization));
    scarcity.push({
      name: 'Utilities delivering below full service',
      count: utilityReadings.length === state.utilities.length
        ? utilityReadings.filter(utility => utility.serviceLevel < 1).length : null,
    }, {
      name: 'Facilities operating above capacity',
      count: facilityReadings.length === state.facilities.length
        ? facilityReadings.filter(facility => facility.utilization > 1).length : null,
    });
  }
  return { checks, scarcity };
}

async function read(fetcher, path, query) {
  const response = await fetcher('/api/causality/' + path + '?' + new URLSearchParams(query));
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(result.message || result.error || 'Request failed.'), { status: response.status });
  }
  return result;
}

export async function loadAuditRun(runId = demoRunId, fetcher = fetch) {
  let run;
  try {
    ({ run } = await read(fetcher, 'run', { runId }));
  } catch (error) {
    if (error.status === 404) return { state: 'missing' };
    throw error;
  }
  if (run.status !== 'completed') return { state: 'incomplete' };
  if (run.context.runId !== runId || run.context.modelVersion !== VERSION) {
    return { state: 'unsupported' };
  }

  const checkpoints = new Map();
  const query = { runId, limit: 250 };
  let cursor = -1;
  while (true) {
    const { items, nextCursor } = await read(fetcher, 'checkpoints', query);
    for (const checkpoint of items) {
      if (checkpoint.domain !== 'world-city' || checkpoint.modelVersion !== VERSION ||
          checkpoint.adapterVersion !== 'city-replay.v1') continue;
      const previous = checkpoints.get(checkpoint.tick);
      if (!previous || checkpoint.id < previous.id) checkpoints.set(checkpoint.tick, checkpoint);
    }
    if (nextCursor === null) break;
    if (!Number.isSafeInteger(nextCursor) || nextCursor <= cursor) throw new Error('The checkpoint cursor did not advance.');
    cursor = nextCursor;
    query.afterSequence = cursor;
  }
  if (!checkpoints.size) return { state: 'no-checkpoints' };
  return { state: 'ready', context: run.context, checkpoints };
}

export async function loadAuditMonth(run, month, fetcher = fetch) {
  const checkpoint = run.checkpoints.get(month);
  if (!checkpoint) return { state: 'unavailable' };
  const context = { ...run.context, tick: month };
  let result;
  try {
    result = await read(fetcher, 'state', {
      context: JSON.stringify(context), tick: month, checkpointId: checkpoint.id,
    });
  } catch (error) {
    if (error.status === 404) return { state: 'unavailable' };
    if (error.status === 400 || error.status === 409) return { state: 'rejected', reason: error.message };
    throw error;
  }
  if (!result.context || !sameRun(result.context, context) || result.context.tick !== month ||
      result.mode !== 'recorded-playback' || result.targetTick !== month ||
      result.checkpoint?.id !== checkpoint.id || result.checkpoint.tick !== month ||
      result.state?.month !== month || result.state.version !== context.modelVersion ||
      result.state.seed !== context.seed) {
    return { state: 'rejected', reason: 'The returned state did not match the selected stored checkpoint.' };
  }
  return {
    state: 'ready',
    report: auditCityCheckpoint(result.state),
    checkpoint: result.checkpoint,
    replayLink: '/world/causal.html?' + new URLSearchParams({ runId: context.runId, month }),
  };
}
