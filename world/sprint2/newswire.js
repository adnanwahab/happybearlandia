import { cityEntityId, demoRunId } from '../causal/demo.js';
import { buildEditions } from '../newspaper/editions.js';

export const UNMAPPED = 'unmapped';
export const CITYWIDE = 'citywide';
export { demoRunId };

async function read(route, parameters, fetcher, signal) {
  const response = await fetcher('/api/causality/' + route + '?' + new URLSearchParams(parameters), { signal });
  if (!response.ok) throw new Error(`Could not read saved ${route} (HTTP ${response.status}).`);
  return response.json();
}

async function readPages(route, parameters, cursorKey, initialCursor, fetcher, signal) {
  const query = { ...parameters, limit: 250 };
  const rows = [];
  let cursor = initialCursor;
  while (true) {
    const { items, nextCursor } = await read(route, query, fetcher, signal);
    rows.push(...items);
    if (nextCursor === null) return rows;
    if (typeof nextCursor !== typeof cursor ||
        (typeof cursor === 'number' && !Number.isSafeInteger(nextCursor)) || nextCursor <= cursor) {
      throw new Error(`The ${route} cursor did not advance.`);
    }
    cursor = nextCursor;
    query[cursorKey] = cursor;
  }
}

export async function listNewswireRuns({ fetcher = fetch } = {}) {
  const runs = await readPages('runs', { status: 'completed' }, 'afterId', '', fetcher);
  return runs.filter(run => run.metadata?.manifest?.domain === 'world-city' ||
    (run.metadata?.manifest?.domain == null && run.context.modelVersion.startsWith('city-systems.')));
}

async function readDistricts(run, checkpoints, fetcher, signal) {
  const checkpoint = checkpoints.find(row => row.domain === 'world-city' &&
    row.modelVersion === run.context.modelVersion && row.tick === run.context.tick);
  if (!checkpoint) return { districts: [], mappingIssue: 'This run has no saved starting city checkpoint.' };

  try {
    const result = await read('state', {
      context: JSON.stringify(run.context), tick: checkpoint.tick, checkpointId: checkpoint.id,
    }, fetcher, signal);
    if (result.checkpoint?.id !== checkpoint.id || result.context?.runId !== run.id ||
        result.targetTick !== checkpoint.tick || result.state?.month !== checkpoint.tick ||
        !Array.isArray(result.state.districts)) {
      throw new Error('The checkpoint did not return the selected city inventory.');
    }
    return { districts: result.state.districts, mappingIssue: '' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { districts: [], mappingIssue: error.message };
  }
}

export function buildNewswire(run, events, checkpoints, districts) {
  const neighborhoods = districts.map(({ id, name }) => ({
    id: cityEntityId(run.context.worldId, 'district', id),
    name: name || id,
    localId: id,
  }));
  const byLocalId = new Map(neighborhoods.map(district => [district.localId, district]));
  const stories = buildEditions(events).flatMap(({ year, stories }) => stories.map(story => {
    const { event, district: geographyId } = story;
    const district = byLocalId.get(geographyId);
    const recordedDistrict = district && event.entityIds.includes(district.id) ? district : null;
    const citywide = geographyId == null && event.entityIds.length === 0;
    return {
      ...story,
      year,
      month: (event.context.tick - 1) % 12 + 1,
      neighborhoodId: recordedDistrict?.id ?? (citywide ? CITYWIDE : UNMAPPED),
      neighborhoodName: recordedDistrict?.name ?? (citywide ? 'Citywide' : 'Unmapped'),
    };
  })).filter(story => story.event.context.tick > 0)
    .sort((a, b) => b.event.context.tick - a.event.context.tick || b.event.sequence - a.event.sequence);
  // Include recorded months without a selected newspaper story.
  const ticks = [...new Set([
    ...checkpoints.filter(row => row.domain === 'world-city').map(row => row.tick),
    ...events.map(event => event.context.tick),
  ])].filter(tick => tick > 0).sort((a, b) => a - b);
  return { neighborhoods, stories, ticks };
}

export async function readNewswire(run, { fetcher = fetch, signal } = {}) {
  const [events, checkpoints] = await Promise.all(['events', 'checkpoints'].map(route =>
    readPages(route, { runId: run.id }, 'afterSequence', -1, fetcher, signal)));
  const { districts, mappingIssue } = await readDistricts(run, checkpoints, fetcher, signal);
  return { ...buildNewswire(run, events, checkpoints, districts), mappingIssue };
}

export function filterNewswire(stories, { neighborhood = '', month = '', year = '' } = {}) {
  return stories.filter(story => (!neighborhood || story.neighborhoodId === neighborhood) &&
    (!month || story.month === Number(month)) && (!year || story.year === Number(year)));
}
