import { canonicalId } from '../../shared/causality/index.js';

const SAVE_ID = /^[A-Za-z0-9_-]{8,16}$/;
const retained = ['universeId', 'worldId', 'scenarioId', 'runId', 'branchId'];

export function journeyURL(surface, selection, source = '') {
  const { experiment, person, household, tick } = selection;
  if (!SAVE_ID.test(experiment)) throw new Error('Invalid saved experiment ID.');
  const query = new URLSearchParams();
  const incoming = new URLSearchParams(source);
  for (const key of retained) if (incoming.has(key)) query.set(key, incoming.get(key));
  query.set('experiment', experiment);
  query.set('experimentId', canonicalId('experiment', 'world-save', experiment));
  if (person) {
    query.set('person', person);
    query.set('entityId', canonicalId('person', 'population', person));
  }
  if (Number.isSafeInteger(tick) && tick >= 0) query.set('tick', tick);
  const lineage = incoming.get('future');
  if (lineage && SAVE_ID.test(lineage)) query.set('future', lineage);
  if (surface === 'world') return '/world?' + query;
  if (surface === 'worldline') return '/tools/future-journey.html?' + query;
  if (surface === 'house' && household && person) {
    query.set('playableLife', '1');
    query.set('journey', '1');
    return '/world/house/' + encodeURIComponent(household) + '?' + query;
  }
  throw new Error('This checkpoint has no matching household entry.');
}
