import { sameRun } from '../../../shared/causality/index.js';
import { cityEntityId, demoCheckpointId, demoLastMonth, demoRunId } from '../../causal/demo.js';
import { cityInventory, indexConstructionEvidence } from '../../causal/history.js';

export const collections = {
  buildings: 'Buildings', households: 'Households', businesses: 'Businesses', links: 'District links',
};

function eventEvidence(events, context) {
  const construction = indexConstructionEvidence(events, context.worldId);
  const direct = new Map();
  const recorded = new Map(events.map(event => [event.id, event]));
  for (const event of events) {
    const tick = event.context.tick;
    for (const id of event.entityIds) {
      if (['HOUSEHOLD_RELOCATED', 'LINK_AVAILABILITY_CHANGED'].includes(event.type)) {
        direct.set(`${tick}/${id}`, event);
      }
    }
    const business = event.payload.source?.payload?.businessId;
    if (['BUSINESS_OPENED', 'BUSINESS_CLOSED'].includes(event.type) && typeof business === 'string') {
      const id = cityEntityId(context.worldId, 'business', business);
      direct.set(`${tick}/${id}`, event);
    }
  }
  return (tick, id) => recorded.get(construction(tick, id)) ?? direct.get(`${tick}/${id}`);
}

export function buildLayers(inventories, events, context) {
  const evidence = eventEvidence(events, context);
  const entities = Object.fromEntries(Object.keys(collections).map(collection => [collection, new Map()]));
  for (const { month, inventory } of inventories) {
    for (const [collection, entries] of Object.entries(entities)) {
      const current = new Map(inventory[collection].map(row => [row.id, row]));
      for (const [id, entity] of entries) {
        const row = current.get(id);
        const description = row?.description ?? null;
        if (entity.layers.at(-1).description !== description) {
          entity.layers.push({ month, description, event: evidence(month, id) });
        }
        current.delete(id);
      }
      for (const [id, row] of current) {
        entries.set(id, {
          id, name: row.name, firstMonth: month,
          layers: [{ month, description: row.description, event: evidence(month, id) }],
        });
      }
    }
  }
  return Object.fromEntries(Object.entries(entities).map(([key, entries]) => [
    key, [...entries.values()].sort((a, b) => b.firstMonth - a.firstMonth || a.name.localeCompare(b.name)),
  ]));
}

export async function loadLayers(fetcher = fetch, signal) {
  const request = (route, params) => fetcher('/api/causality/' + route + '?' + new URLSearchParams(params), { signal });
  const runResponse = await request('run', { runId: demoRunId });
  if (runResponse.status === 404) return { state: 'missing' };
  if (!runResponse.ok) throw new Error('Could not read the saved city run.');
  const { run } = await runResponse.json();
  if (run.status !== 'completed') return { state: 'incomplete' };
  const { context } = run;

  const events = [];
  let cursor = -1;
  while (true) {
    const query = { runId: demoRunId, limit: 1000, ...(cursor >= 0 && { afterSequence: cursor }) };
    const response = await request('events', query);
    if (!response.ok) throw new Error('Could not load recorded city events.');
    const { items, nextCursor } = await response.json();
    events.push(...items);
    if (nextCursor === null) break;
    if (!Number.isSafeInteger(nextCursor) || nextCursor <= cursor) throw new Error('The city event cursor did not advance.');
    cursor = nextCursor;
  }

  async function loadMonth(month) {
    const checkpointId = demoCheckpointId(demoRunId, month);
    const response = await request('state', {
      context: JSON.stringify({ ...context, tick: month }), tick: month, checkpointId,
    });
    if (!response.ok) throw new Error(`Recorded month ${month} could not be loaded.`);
    const result = await response.json();
    if (!result.context || !sameRun(result.context, context) || result.checkpoint?.id !== checkpointId ||
        result.checkpoint.tick !== month || result.state?.month !== month || result.targetTick !== month) {
      throw new Error(`The server did not return the exact checkpoint for month ${month}.`);
    }
    return { month, inventory: cityInventory(result.state, context.worldId) };
  }

  const inventories = [];
  for (let start = 0; start <= demoLastMonth; start += 4) {
    const group = Array.from({ length: Math.min(4, demoLastMonth + 1 - start) }, (_, offset) => loadMonth(start + offset));
    inventories.push(...await Promise.all(group));
  }
  return { state: 'ready', context, entities: buildLayers(inventories, events, context) };
}
