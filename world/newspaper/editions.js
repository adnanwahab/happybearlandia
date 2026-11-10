import { demoRunId } from '../causal/demo.js';
import { contextURL } from '../universe/navigation.js';

// Identity of the fixed scenario recorded by POST /api/causality/world-scenario.
export const DEMO_RUN_ID = demoRunId;

const storiesByType = new Map([
  ['PROJECT_COMPLETE', ['Housing & construction', 'A construction project is completed',
    ({ payload }) => `Project ${payload.projectId} reached completion. The event lists ${payload.units} units for this project.`]],
  ['FLOOD_DAMAGE', ['Environment', 'Flood damage recorded',
    ({ payload }) => `The flood damage record covers ${payload.units} housing units.`]],
  ['ANNUAL_POPULATION_UPDATE', ['Population', 'The city records its annual population update',
    ({ payload }) => `The model recorded ${payload.formed} household formations and ${payload.departed} departures.`]],
  ['CONSTRUCTION_STARTED', ['Housing & construction', 'Construction gets underway',
    ({ payload }) => `Project ${payload.projectId} entered construction.`]],
  ['BUSINESS_OPENED', ['Business', 'A business opens',
    ({ payload }) => `Business ${payload.businessId} opened with ${payload.jobs} jobs recorded at opening.`]],
  ['BUSINESS_CLOSED', ['Business', 'A business closes',
    ({ payload }) => `The business model recorded the closure of ${payload.businessId}.`]],
]);

export function eventLink(event) {
  const { universeId, worldId, scenarioId, runId, tick } = event.context;
  const entityId = event.entityIds[0];
  const context = { universeId, worldId, scenarioId, runId, tick, ...(entityId && { entityId }) };
  const route = '/world/causality/inspect.html?' + new URLSearchParams({ targetId: event.id });
  return contextURL(route, context);
}

export function buildEditions(events) {
  const editions = new Map();
  const priorities = [...storiesByType.keys()];
  const ordered = [...events].sort((a, b) =>
    priorities.indexOf(a.type) - priorities.indexOf(b.type) || b.sequence - a.sequence);
  for (const event of ordered) {
    const year = Math.max(1, Math.ceil(event.context.tick / 12));
    const edition = editions.get(year) ?? { year, stories: [] };
    editions.set(year, edition);

    const template = storiesByType.get(event.type);
    const source = event.payload?.source;
    if (!template || !source?.payload || event.provenance.kind !== 'simulated') continue;
    const [desk, headline, report] = template;
    edition.stories.push({
      event,
      desk,
      headline,
      copy: report(source),
      district: source.geographyId,
      href: eventLink(event),
    });
  }
  return [...editions.values()].sort((a, b) => b.year - a.year);
}

export async function loadArchive(fetcher = fetch) {
  const query = new URLSearchParams({ runId: DEMO_RUN_ID });
  const runResponse = await fetcher('/api/causality/run?' + query);
  if (runResponse.status === 404) return { state: 'missing' };
  if (!runResponse.ok) throw new Error('Could not read the recorded run.');
  const { run } = await runResponse.json();
  if (run.status !== 'completed') return { state: 'incomplete' };

  const events = [];
  query.set('limit', '250');
  while (true) {
    const response = await fetcher('/api/causality/events?' + query);
    if (!response.ok) throw new Error('Could not read the recorded events.');
    const { items, nextCursor } = await response.json();
    events.push(...items);
    if (nextCursor === null) break;
    if (!Number.isSafeInteger(nextCursor) || nextCursor <= Number(query.get('afterSequence') ?? -1)) {
      throw new Error('The event feed returned an invalid cursor.');
    }
    query.set('afterSequence', String(nextCursor));
  }

  return { state: 'ready', run, editions: buildEditions(events) };
}
