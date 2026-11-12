import {createSpatialMapping} from '../scene/mapping.js';

const key = row => `${row.collection}:${row.id}`;
function changes(diff) {
  if (!diff) return [];
  if (Array.isArray(diff.entities)) return diff.entities;
  return Object.entries(diff.entities || {}).flatMap(([collection, group]) =>
    ['added', 'removed', 'modified'].flatMap(type => (group?.[type] || []).map(row => ({...row, collection}))));
}
/** First recorded, renderable building divergence, never a project/policy proxy. */
export function firstDivergence(history, diffs) {
  const mapping = createSpatialMapping();
  for (const diff of [...(diffs || [])].sort((a, b) => a.month - b.month)) {
    const month = diff.month;
    const a = history?.baseline?.find(s => (s.month ?? s.state?.month) === month)?.state;
    const b = history?.plan?.find(s => (s.month ?? s.state?.month) === month)?.state;
    if (!a || !b || ![a,b].every(state => Array.isArray(state.buildings) && Array.isArray(state.projects))) continue;
    const projected = mapping.frame(a, b);
    const candidates = changes(diff).filter(row => row.collection === 'buildings' &&
      (row.physical === true || (!Object.hasOwn(row, 'physical') &&
        (['added', 'removed'].includes(row.kind) || (row.changedFields || []).some(f => ['floors', 'height', 'geometry', 'bbox', 'parcelId'].includes(f))))));
    for (const row of candidates.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
      if ([...projected.a, ...projected.b].some(mapped => key(mapped) === key(row))) {
        return {month, entity: {collection: 'buildings', id: row.id}};
      }
    }
  }
  return null;
}

