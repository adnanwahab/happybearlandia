import { listLivingSaves } from '../timeline-braids/comparison.js';
import { readFuture } from './model.js';
import { compatiblePopulationContinuation } from '../population/population-growth.js';
import { journeyURL } from './navigation.js';

// Bound checkpoint decoding/network work on low-memory devices; never run a model.
export const MAP_LIMIT = 16;
export async function lineageMap(checkpoints, fetcher = fetch) {
  const nodes = checkpoints.map(source => ({ id: source.record.id, source }));
  let notice = '';
  try {
    const catalog = await listLivingSaves(fetcher);
    const seen = new Set(nodes.map(node => node.id));
    for (let i = 0; i < nodes.length && nodes.length < MAP_LIMIT; i++) {
      const parent = nodes[i].source;
      if (!parent) continue;
      for (const row of catalog) {
        if (row.parentId !== parent.record.id || seen.has(row.id)) continue;
        if (nodes.length >= MAP_LIMIT) break;
        seen.add(row.id);
        try {
          const child = await readFuture(row.id, fetcher);
          if (child.record.parentId !== parent.record.id ||
              child.state.runtime.tick < parent.state.runtime.tick ||
              child.state.runtime.stepMinutes !== parent.state.runtime.stepMinutes ||
              !compatiblePopulationContinuation(parent.state.model, child.state.model)) {
            throw new Error('Incompatible population or clock.');
          }
          nodes.push({ id: row.id, source: child });
        } catch (error) {
          nodes.push({ id: row.id, parentId: row.parentId, error: error.message });
        }
      }
    }
    if (catalog.some(row => seen.has(row.parentId) && !seen.has(row.id))) notice = `Map limited to ${MAP_LIMIT} checkpoints. Open a child to explore further.`;
  } catch {
    notice = 'Branch catalog unavailable; showing the loaded ancestor chain.';
  }
  const first = checkpoints[0];
  if (first?.record.parentId) nodes.unshift({ id: first.record.parentId, error: 'Ancestor unavailable or incompatible; see checkpoint status.' });
  return { nodes, notice };
}

export function renderLineage(container, nodes, selectedId, person, document = container.ownerDocument) {
  const list = document.createElement('ol');
  list.className = 'future-lines';
  for (const node of nodes) {
    const item = document.createElement('li');
    const record = node.source?.record;
    const state = node.source?.state;
    const parentId = record?.parentId || node.parentId;
    const ancestors = new Set([node.id]);
    let ancestor = parentId;
    while (ancestor && !ancestors.has(ancestor)) {
      ancestors.add(ancestor);
      const parent = nodes.find(row => row.id === ancestor);
      ancestor = parent?.source?.record.parentId || parent?.parentId;
    }
    item.style.marginLeft = `${Math.min(ancestors.size - 1, 4) * .75}rem`;
    const description = document.createElement('p');
    if (!record) {
      description.textContent = `${node.id} · Unavailable: ${node.error}`;
      item.append(description);
    } else {
      const link = document.createElement('a');
      link.textContent = record.save.label;
      link.href = journeyURL('worldline', { experiment: node.id, person, tick: state.runtime.tick });
      if (node.id === selectedId) link.setAttribute('aria-current', 'step');
      const fork = record.save.view.journeyFork;
      const parent = nodes.find(row => row.id === parentId)?.source;
      const horizon = parent ? ` · Horizon +${state.runtime.tick - parent.state.runtime.tick} ticks / +${state.model.minute - parent.state.model.minute} minutes` : '';
      description.textContent = `${parentId ? `From ${parentId} → ` : 'Origin · '}${node.id} · ${fork?.version === 'population-rain-fork.v1' ? `Rain ${fork.rainIntensity}` : 'Saved checkpoint; intervention unspecified'}${horizon} · Tick ${state.runtime.tick} · Minute ${state.model.minute} · ${state.model.modelVersion} · Seed ${state.model.config.seed} · Synthetic modeled state`;
      item.append(link, description);
    }
    list.append(item);
  }
  container.replaceChildren(list);
}
