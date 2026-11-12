// Rendering policy only: never infer a dependency or modify simulation records.
export const PULSE_LIMIT = 8;
export function selectPulses(nodes, edges, evidence, selectedId) {
  const records = new Map(nodes.map(node => [node.id, node]));
  const sources = new Set(evidence.map(record => record.id));
  const selected = records.get(selectedId);
  const eligible = edges.filter(edge => {
    const from = records.get(edge.fromId), to = records.get(edge.toId);
    return ['causes', 'contributes', 'constrains'].includes(edge.relation) &&
      from?.type && to?.type && selected?.context?.runId &&
      from.context?.runId === selected.context.runId && to.context?.runId === selected.context.runId &&
      Number.isFinite(from.context.tick) && Number.isFinite(to.context.tick) &&
      from.context.tick <= to.context.tick &&
      edge.evidenceIds?.length > 0 && edge.evidenceIds.every(id => sources.has(id));
  });
  // Only the selected record's connected component, even for overbroad responses.
  const connected = new Set([selectedId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of eligible) {
      if (!connected.has(edge.fromId) && !connected.has(edge.toId)) continue;
      for (const id of [edge.fromId, edge.toId]) {
        if (!connected.has(id)) { connected.add(id); changed = true; }
      }
    }
  }
  const linked = eligible.filter(edge => connected.has(edge.fromId))
    .sort((a, b) => records.get(a.fromId).context.tick - records.get(b.fromId).context.tick ||
      a.id.localeCompare(b.id));
  return { edges: linked.slice(0, PULSE_LIMIT), eligible: linked.length };
}
