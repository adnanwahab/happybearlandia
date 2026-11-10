import { discoverMonthlyObservations } from './engine.js';

export { demoRunId } from '../causal/demo.js';

export async function readMonthlyDiscoveries(runId, { fetcher = fetch, signal } = {}) {
  const get = async (route, parameters) => {
    const query = new URLSearchParams({ runId, ...parameters });
    const response = await fetcher('/api/causality/' + route + '?' + query, { signal });
    const data = await response.json();
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(data.error || 'Could not read stored records.');
    return data;
  };

  const { run } = await get('run') ?? {};
  if (!run) return { status: 'missing' };
  if (run.metadata?.manifest?.domain !== 'world-city') return { status: 'unsupported' };
  if (run.status !== 'completed') return { status: 'unfinished' };

  const rows = [];
  let afterSequence;
  // Bound browser work and avoid scoring a truncated series.
  for (let page = 0; page < 20; page++) {
    const parameters = { limit: 1000 };
    if (afterSequence !== undefined) parameters.afterSequence = afterSequence;
    const result = await get('observations', parameters);
    if (!result) return { status: 'missing' };
    rows.push(...result.items);
    if (result.nextCursor === null) {
      return { status: 'ready', run, ...discoverMonthlyObservations(run, rows) };
    }
    if (!Number.isSafeInteger(result.nextCursor) || result.nextCursor <= (afterSequence ?? -1)) {
      throw new Error('The observation cursor did not advance.');
    }
    afterSequence = result.nextCursor;
  }
  return { status: 'too-large' };
}
