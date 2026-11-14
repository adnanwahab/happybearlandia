// Rendering policy only: never infer a dependency or modify simulation records.
export const PULSE_LIMIT = 8;
export const PULSE_INPUT_LIMIT = 2048;
export function selectPulses(nodes, edges, evidence, selectedId) {
  const truncated = [nodes, edges, evidence].some(items => items.length > PULSE_INPUT_LIMIT);
  if (truncated) return { edges: [], eligible: 0, gaps: ['input-limit'] };
  const gaps = new Set();
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
      edge.evidenceIds?.length > 0 && edge.evidenceIds.length <= PULSE_INPUT_LIMIT && edge.evidenceIds.every(id => sources.has(id));
  });
  // Sorted outgoing adjacency gives stable breadth-first replay, without recursion.
  const outgoing = new Map();
  for (const edge of eligible.sort((a, b) => a.id.localeCompare(b.id))) {
    if (!outgoing.has(edge.fromId)) outgoing.set(edge.fromId, []);
    outgoing.get(edge.fromId).push(edge);
  }
  const visited = new Set([selectedId]), queue = [selectedId], linked = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const edge of outgoing.get(queue[cursor]) ?? []) {
      if (visited.has(edge.toId)) {
        // Converging branches are retained, but never expand a node twice.
        if (edge.toId === selectedId) gaps.add('cycle-bounded');
      } else { visited.add(edge.toId); queue.push(edge.toId); }
      linked.push(edge);
    }
  }
  if (eligible.length !== edges.length) gaps.add('unsupported-or-unavailable');
  if (linked.length > PULSE_LIMIT) gaps.add('pulse-limit');
  return { edges: linked.slice(0, PULSE_LIMIT), eligible: linked.length, gaps: [...gaps] };
}
