import { sameRun } from '../../../shared/causality/index.js';
import { cityEntityId, demoCheckpointId, demoRunId } from '../../causal/demo.js';
import { VERSION } from '../../city/contracts.js';

export const RULES_VERSION = 'flood-perspectives.v1';

const roles = [
  {
    title: 'Finding another home',
    matches: resident => resident.exposed && Boolean(resident.after.unitId),
    reading: 'From this household’s position, finding another place to live would be the immediate concern.',
  },
  {
    title: 'Waiting for housing',
    matches: resident => resident.exposed && resident.after.unitId === null,
    reading: 'From this household’s position, the flood could be understood as a loss of housing with no replacement by month’s end.',
  },
  {
    title: 'Getting to work',
    matches: resident => Boolean(resident.routeEvent),
    reading: 'For this worker, getting to the assigned job offers another way to read the same month.',
  },
  {
    title: 'Watching from another district',
    matches: resident => resident.outside && resident.before.unitId === resident.after.unitId,
    reading: 'A resident elsewhere could view this as a district emergency while their own housing stayed the same.',
  },
];

function evidenceLink(event) {
  const { universeId, worldId, scenarioId, runId, tick } = event.context;
  return '/world/causality/inspect.html?' + new URLSearchParams({
    universeId, worldId, scenarioId, runId, tick, targetId: event.id,
  });
}

function replayLink(context, month, entityId) {
  const query = new URLSearchParams({ runId: context.runId, month });
  if (entityId) query.set('inspectEntity', entityId);
  return '/world/causal.html?' + query;
}

function validateCheckpoint(checkpoint, context, month) {
  if (!checkpoint?.context || !sameRun(checkpoint.context, context) ||
      checkpoint.mode !== 'recorded-playback' ||
      checkpoint.checkpoint?.id !== demoCheckpointId(context.runId, month) ||
      checkpoint.checkpoint.tick !== month || checkpoint.targetTick !== month ||
      checkpoint.state?.month !== month || checkpoint.state.seed !== context.seed ||
      checkpoint.state.version !== context.modelVersion) {
    throw new Error(`The stored checkpoint for month ${month} could not be verified.`);
  }
}

function isFloodDamage(event) {
  const source = event.payload?.source;
  return event.type === 'FLOOD_DAMAGE' && event.provenance?.kind === 'simulated' &&
    event.context?.tick > 0 && source?.system === 'environment' &&
    source.simulationTime === event.context.tick &&
    typeof source.geographyId === 'string' && Number.isSafeInteger(source.payload?.units);
}

export function buildPerspectives({ flood, previous, current, events }) {
  if (!isFloodDamage(flood)) throw new Error('A recorded city flood-damage event is required.');
  const { context } = flood;
  const month = context.tick;
  validateCheckpoint(previous, context, month - 1);
  validateCheckpoint(current, context, month);

  const before = previous.state;
  const after = current.state;
  const { geographyId: districtId, payload } = flood.payload.source;
  const previousWorkers = new Map(before.workers.map(worker => [worker.id, worker]));
  const previousHouseholds = new Map(before.households.map(household => [household.id, household]));
  const currentHouseholds = new Map(after.households.map(household => [household.id, household]));
  const previousUnits = new Map(before.units.map(unit => [unit.id, unit]));
  const currentUnits = new Map(after.units.map(unit => [unit.id, unit]));
  const districts = new Map(after.districts.map(district => [district.id, district.name]));
  const routes = new Map();
  for (const event of events) {
    const source = event.payload?.source;
    if (event.type === 'UNREACHABLE_JOB' && event.provenance?.kind === 'simulated' &&
        event.context?.tick === month && sameRun(event.context, context) &&
        source?.system === 'transport' && source.simulationTime === month &&
        source.geographyId === districtId && typeof source.payload?.workerId === 'string') {
      routes.set(source.payload.workerId, event);
    }
  }

  const residents = [];
  for (const worker of after.workers) {
    const priorWorker = previousWorkers.get(worker.id);
    if (priorWorker?.householdId !== worker.householdId) continue;
    const priorHome = previousHouseholds.get(worker.householdId);
    const nextHome = currentHouseholds.get(worker.householdId);
    if (!priorHome || !nextHome) continue;
    const oldUnit = previousUnits.get(priorHome.unitId);
    const oldUnitNow = currentUnits.get(priorHome.unitId);
    const exposed = oldUnit?.districtId === districtId && oldUnit.status === 'occupied' &&
      oldUnit.householdId === priorHome.id && oldUnitNow?.status === 'under renovation';
    const outside = Boolean(oldUnit) && oldUnit.districtId !== districtId &&
      nextHome.districtId !== districtId;
    residents.push({
      worker, before: priorHome, after: nextHome, exposed, outside,
      routeEvent: routes.get(worker.id), oldUnitNow,
    });
  }
  residents.sort((a, b) => a.worker.id.localeCompare(b.worker.id, 'en'));

  const selected = new Set();
  // Reserve the least interchangeable perspective before selecting housing examples.
  const commuter = residents.find(roles[2].matches);
  if (commuter) selected.add(commuter.before.id);
  const perspectives = roles.map((role, index) => {
    const resident = index === 2 ? commuter : residents.find(candidate =>
      !selected.has(candidate.before.id) && role.matches(candidate));
    if (!resident) return { title: role.title, resident: null };
    const { worker, before: from, after: to, oldUnitNow, routeEvent } = resident;
    selected.add(from.id);
    const residentId = cityEntityId(context.worldId, 'person', worker.id);
    return {
      title: role.title,
      resident: worker.name ?? worker.id,
      household: from.id,
      interpretation: role.reading,
      before: { district: districts.get(from.districtId) ?? from.districtId, unitId: from.unitId },
      after: { district: districts.get(to.districtId) ?? to.districtId, unitId: to.unitId },
      priorUnitStatus: oldUnitNow?.status ?? null,
      routeEvidence: routeEvent ? evidenceLink(routeEvent) : null,
      beforeLink: replayLink(context, month - 1, residentId),
      afterLink: replayLink(context, month, residentId),
    };
  });
  return {
    month,
    district: districts.get(districtId) ?? districtId,
    affectedUnits: payload.units,
    seed: context.seed,
    modelVersion: context.modelVersion,
    rulesVersion: RULES_VERSION,
    evidenceLink: evidenceLink(flood),
    replayLink: replayLink(context, month) + '&' + new URLSearchParams({ event: flood.id }),
    perspectives,
  };
}

export async function loadPerspectives(fetcher = fetch) {
  async function read(path, params) {
    const response = await fetcher('/api/causality/' + path + '?' + new URLSearchParams(params));
    if (path === 'run' && response.status === 404) return null;
    if (!response.ok) throw new Error(`Stored ${path} could not be read (HTTP ${response.status}).`);
    return response.json();
  }
  const { run } = await read('run', { runId: demoRunId }) ?? {};
  if (!run) return { state: 'missing' };
  if (run.status !== 'completed') return { state: 'incomplete' };
  const { context } = run;
  if (context.runId !== demoRunId || context.modelVersion !== VERSION) {
    throw new Error('This saved run uses an unsupported city model.');
  }

  const events = [];
  const query = { runId: demoRunId, limit: 250 };
  let cursor = -1;
  while (true) {
    const { items, nextCursor } = await read('events', query);
    events.push(...items);
    if (nextCursor === null) break;
    if (!Number.isSafeInteger(nextCursor) || nextCursor <= cursor) {
      throw new Error('The stored event feed returned an invalid cursor.');
    }
    cursor = nextCursor;
    query.afterSequence = cursor;
  }
  const flood = events.find(event => isFloodDamage(event) && sameRun(event.context, context));
  if (!flood) return { state: 'no-event' };

  const month = flood.context.tick;
  const checkpoint = tick => read('state', {
    context: JSON.stringify({ ...context, tick }),
    tick,
    checkpointId: demoCheckpointId(context.runId, tick),
  });
  const [previous, current] = await Promise.all([checkpoint(month - 1), checkpoint(month)]);
  return { state: 'ready', report: buildPerspectives({ flood, previous, current, events }) };
}
