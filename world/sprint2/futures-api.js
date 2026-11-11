import { sameRun } from '../../shared/causality/index.js';
import { demoRunId } from '../causal/demo.js';
import { VERSION } from '../city/contracts.js';

const route = '/api/causality/saved-futures';
const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store' },
});

function recordedMonths(store, run) {
  const months = new Set();
  let cursor = -1;
  do {
    const { items, nextCursor } = store.listCheckpoints(run.id, { limit: 250, afterSequence: cursor });
    for (const { id, context, state } of items) {
      if (state?.schemaVersion === 'replay-checkpoint.v1' && state.id === id &&
          state.domain === 'world-city' && state.modelVersion === run.context.modelVersion &&
          state.adapterVersion === 'city-replay.v1' && state.tick === context.tick &&
          state.context && sameRun(state.context, run.context) && state.context.tick === context.tick &&
          Number.isSafeInteger(context.tick) && context.tick >= 0) {
        months.add(context.tick);
      }
    }
    cursor = nextCursor;
  } while (cursor !== null);
  return [...months].sort((a, b) => a - b);
}

/** Only pass IDs whose complete history has been approved for public viewing. */
export function createSavedFuturesHandler({ store, publicRunIds = [demoRunId] }) {
  const ids = [...new Set(publicRunIds)].sort();
  return request => {
    if (new URL(request.url).pathname !== route) return null;
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    try {
      const items = [];
      for (const id of ids) {
        const run = store.getRun(id);
        if (run?.status !== 'completed' || run.context.modelVersion !== VERSION ||
            (run.metadata?.manifest?.domain ?? 'world-city') !== 'world-city') continue;
        const months = recordedMonths(store, run);
        if (months.length === 0) continue;
        const { seed, modelVersion, parentRunId } = run.context;
        const kind = id === demoRunId ? 'Demo' : parentRunId ? 'Branch' : 'Recording';
        items.push({ id, seed, modelVersion, kind, months });
      }
      return json({ items });
    } catch {
      return json({ error: 'Could not read saved city runs.' }, 503);
    }
  };
}
