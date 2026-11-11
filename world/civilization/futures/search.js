import { canonicalId, ObservationSchema, RunContextSchema, sameRun } from '../../../shared/causality/index.js';
import { VERSION } from '../../city/contracts.js';
import { contextURL } from '../../universe/navigation.js';

const metric = name => canonicalId('metric', 'world-city', name);
const metricDefinitions = [
  { key: 'rent', id: metric('meanRent'), label: 'Mean unit rent', unit: 'modeled USD/month' },
  { key: 'travel', id: metric('meanTravelMinutes'), label: 'Mean district-link travel time', unit: 'minutes' },
];
const housingCount = metric('housingUnits');
const operators = new Map([
  ['lower', change => change < 0],
  ['at-most', change => change <= 0],
  ['any', () => true],
]);

function cityRun(run) {
  const context = RunContextSchema.safeParse(run?.context);
  return context.success && run.id === context.data.runId && run.status === 'completed' &&
    context.data.modelVersion === VERSION && run.metadata?.manifest?.domain === 'world-city';
}

function monthPair({ start, end, rent, travel }) {
  if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(end) || end <= start) {
    throw new Error('Choose two whole simulation months with the end after the start.');
  }
  if (!operators.has(rent) || !operators.has(travel)) throw new Error('Choose a supported search condition.');
}

function navigation(run, tick) {
  const { universeId, worldId, scenarioId, runId } = run.context;
  return { universeId, worldId, scenarioId, runId, tick };
}

function evidenceURL(run, observation) {
  return contextURL('/world/causality/inspect.html?' + new URLSearchParams({ targetId: observation.id }),
    navigation(run, observation.context.tick));
}

export function assessRun(run, observations, checkpoints, query) {
  const byMonth = new Map();
  for (const record of observations) {
    if (!record?.context || (record.context.tick !== query.start && record.context.tick !== query.end) ||
        !sameRun(record.context, run.context) || record.entityId !== run.context.worldId) continue;
    const key = record.metricId + '/' + record.context.tick;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(record);
  }

  function sample(id, tick, unit) {
    const rows = byMonth.get(id + '/' + tick) ?? [];
    if (rows.length !== 1) return null;
    const { contentHash, ...row } = rows[0];
    return ObservationSchema.safeParse(row).success && row.unit === unit &&
      row.provenance.kind === 'simulated' && row.provenance.modelVersion === run.context.modelVersion ? row : null;
  }
  const metrics = metricDefinitions.map(definition => {
    function point(tick) {
      const row = sample(definition.id, tick, definition.unit);
      // City reports a zero mean for empty unit and link populations.
      if (!row || row.value <= 0 || (definition.key === 'rent' &&
          !(sample(housingCount, tick, 'units')?.value > 0))) return null;
      return { value: row.value, url: evidenceURL(run, row) };
    }
    const start = point(query.start);
    const end = point(query.end);
    return {
      ...definition,
      start,
      end,
      change: start && end ? end.value - start.value : null,
    };
  });

  const required = metrics.filter(metric => query[metric.key] !== 'any');
  const incomplete = required.some(metric => metric.change === null);
  const matches = required.every(metric => metric.change !== null && operators.get(query[metric.key])(metric.change));
  const months = new Set(checkpoints.filter(checkpoint => checkpoint.domain === 'world-city' &&
    checkpoint.modelVersion === run.context.modelVersion && checkpoint.adapterVersion === 'city-replay.v1')
    .map(checkpoint => checkpoint.tick));
  return {
    run,
    metrics,
    status: incomplete ? 'missing' : matches ? 'match' : 'excluded',
    replay: [query.start, query.end].filter(tick => months.has(tick)).map(tick => ({
      tick,
      url: contextURL('/world/causal.html', navigation(run, tick)),
    })),
  };
}

async function fetchPage(path, params, fetcher, signal) {
  const response = await fetcher('/api/causality/' + path + '?' + new URLSearchParams(params), { signal });
  if (!response.ok) throw new Error('Could not read saved ' + path + '.');
  return response.json();
}

async function readRecords(path, runId, fetcher, signal) {
  const items = [];
  let cursor = -1;
  for (let page = 0; page < 8; page++) {
    const result = await fetchPage(path, {
      runId, limit: 500, ...(cursor >= 0 && { afterSequence: cursor }),
    }, fetcher, signal);
    items.push(...result.items);
    if (result.nextCursor === null) return items;
    if (!Number.isSafeInteger(result.nextCursor) || result.nextCursor <= cursor) {
      throw new Error('The saved ' + path + ' cursor did not advance.');
    }
    cursor = result.nextCursor;
  }
  throw new Error('This run exceeds the browser search limit of 4,000 ' + path + '.');
}

export async function searchFutures(query, { fetcher = fetch, signal } = {}) {
  monthPair(query);
  const page = await fetchPage('runs', { status: 'completed', limit: 60 }, fetcher, signal);
  const runs = page.items.filter(cityRun);
  const truncated = page.nextCursor !== null || runs.length > 24;
  const results = [];
  for (const run of runs.slice(0, 24)) {
    try {
      const [observations, checkpoints] = await Promise.allSettled([
        readRecords('observations', run.id, fetcher, signal),
        readRecords('checkpoints', run.id, fetcher, signal),
      ]);
      if (observations.status === 'rejected') throw observations.reason;
      if (signal?.aborted) throw signal.reason;
      const result = assessRun(run, observations.value, checkpoints.value ?? [], query);
      results.push(result);
    } catch (error) {
      if (signal?.aborted) throw error;
      results.push({ run, status: 'missing', error: error.message });
    }
  }
  return { results, truncated };
}
