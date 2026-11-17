// Read-only projection of persisted ties. Never call the seeded relationship inspector.
export function projectSocialNetwork({ties = {}, rootId, getPerson, depth = 3, maxNodes = 80, maxEdges = 160, provenance = {}}) {
  if (!Number.isInteger(depth) || depth < 0 || depth > 3) throw Error('Use network depth 0–3');
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 80 || !Number.isInteger(maxEdges) || maxEdges < 1 || maxEdges > 160) throw Error('Invalid network limits');
  rootId = String(rootId);
  const exists = id => { const person = getPerson(id); return person && String(person.id) === id; };
  if (!exists(rootId)) throw Error('Unknown network resident');
  const adjacency = new Map(), valid = [];
  let omittedInvalid = 0;
  for (const [ledgerId, tie] of Object.entries(ties).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!tie || typeof tie.a !== 'string' || typeof tie.b !== 'string' || tie.a === tie.b || !exists(tie.a) || !exists(tie.b)) { omittedInvalid++; continue; }
    const edge = {id: ledgerId, from: tie.a, to: tie.b, label: 'Recorded modeled tie'};
    valid.push(edge);
    for (const id of [tie.a, tie.b]) {
      if (!adjacency.has(id)) adjacency.set(id, []);
      adjacency.get(id).push(edge);
    }
  }
  const distances = new Map([[rootId, 0]]), queue = [rootId], admitted = new Map();
  let truncated = false;
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index], distance = distances.get(id);
    if (distance >= depth) continue;
    for (const edge of adjacency.get(id) ?? []) {
      if (admitted.has(edge.id)) continue;
      const other = edge.from === id ? edge.to : edge.from;
      if (admitted.size >= maxEdges || !distances.has(other) && distances.size >= maxNodes) { truncated = true; continue; }
      if (!distances.has(other)) { distances.set(other, distance + 1); queue.push(other); }
      admitted.set(edge.id, edge);
    }
  }
  // Include cycle-closing edges between boundary nodes when budget permits.
  for (const edge of valid) if (depth > 0 && distances.has(edge.from) && distances.has(edge.to) && !admitted.has(edge.id)) {
    if (admitted.size < maxEdges) admitted.set(edge.id, edge); else truncated = true;
  }
  return {
    schemaVersion: 'social-network.v1', rootId, depth, maxNodes, maxEdges, truncated, omittedInvalid,
    provenance: structuredClone(provenance),
    nodes: [...distances].map(([id, distance]) => ({id, distance, label: `Synthetic resident · ${id}`})),
    edges: [...admitted.values()],
  };
}
