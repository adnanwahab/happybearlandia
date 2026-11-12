/** Follow recorded downstream dependencies; never infer links from nearby changes. */
export function inspectRipple(store, runId, targetId) {
  const target = store.getNode(runId, targetId);
  if (!target) return null;
  const nodes = new Map([[target.id, target]]), edges = [], evidence = new Map();
  const reasons = new Set(), missing = new Set(), visited = new Set();
  const queue = [[target.id, [target.id]]];
  // Five edges in the entire response, with at most six expanded records.
  while (queue.length) {
    const [id, path] = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const page = store.listEdges(runId, { sourceId: id, limit: 6 });
    if (page.nextCursor != null) reasons.add('edge-limit');
    for (const edge of page.items) {
      if (edges.length === 5) { reasons.add('edge-limit'); break; }
      const destination = store.getNode(runId, edge.toId);
      if (!destination) { missing.add(edge.toId); reasons.add('missing-dependency'); continue; }
      const citations = (edge.evidenceIds ?? []).slice(0, 100);
      if (citations.length !== edge.evidenceIds?.length) reasons.add('evidence-limit');
      const sources = citations.map(key => {
        const record = store.getNode(runId, key);
        if (!record) { missing.add(key); reasons.add('missing-evidence'); }
        return record;
      }).filter(Boolean);
      if (!sources.some(record => typeof record.type === 'string')) {
        reasons.add('missing-source-event');
        missing.add(edge.id);
        continue;
      }
      for (const source of sources) evidence.set(source.id, source);
      edges.push(edge);
      nodes.set(destination.id, destination);
      if (path.includes(destination.id)) reasons.add('cycle-bounded');
      else queue.push([destination.id, [...path, destination.id]]);
    }
  }
  if (!edges.length) reasons.add('no-supported-downstream-edges');
  const run = store.getRun(runId);
  if (run.status !== 'completed') reasons.add('run-' + run.status);
  return { runId, targetId, context: run.context, nodes: [...nodes.values()], edges,
    evidence: [...evidence.values()], missingIds: [...missing], reasons: [...reasons],
    incomplete: reasons.size > 0, limits: { maxEdges: 5, maxDepth: 5 },
    interpretation: 'Recorded model causation or correlation as labeled on each edge; not empirical causal proof. No inferred connections across gaps.' };
}
