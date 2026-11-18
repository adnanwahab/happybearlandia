// Presentation only. Coordinates must be supplied by an explicit scene adapter.
export const PATH_LIMIT = 32;
export const INPUT_LIMIT = 2048;
const sameScope = (a, b) => a && b && ['runId', 'worldId', 'scenarioId', 'universeId', 'modelVersion', 'seed'].every(k => a[k] === b[k] && a[k] !== undefined);
export function projectEvidencePath(data, mapping, frameId) {
  const empty = reason => ({segments: [], records: [], notices: [reason]});
  if (!data || ![data.nodes, data.edges, data.evidence].every(Array.isArray)) return empty('Invalid evidence response.');
  if ([data.nodes, data.edges, data.evidence].some(a => a.length > INPUT_LIMIT)) return empty('Evidence input limit reached.');
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  if (nodes.size !== data.nodes.length) return empty('Duplicate record identities.');
  const target = nodes.get(data.targetId), scope = target?.context;
  if (!scope || data.runId !== scope.runId) return empty('Selected run or target unavailable.');
  const notices = new Set(data.incomplete ? ['History incomplete: ' + (data.reasons ?? []).join(', ')] : []);
  const records = [...new Map([...data.nodes, ...data.evidence].filter(n => sameScope(n.context, scope)).map(n => [n.id,n])).values()]
    .sort((a,b) => a.context.tick - b.context.tick || a.id.localeCompare(b.id));
  const evidence = new Set(data.evidence.filter(n => sameScope(n.context, scope)).map(n => n.id));
  const anchors = new Map();
  if (mapping?.version === 1 && typeof frameId === 'string' && frameId.length > 0 && mapping.frameId === frameId && sameScope(mapping.context, scope) && Array.isArray(mapping.anchors) && mapping.anchors.length <= INPUT_LIMIT) {
    for (const a of mapping.anchors) {
      // Duplicates invalidate the mapping; never silently choose one location.
      if (anchors.has(a.eventId)) return empty('Duplicate event locations.');
      anchors.set(a.eventId, a);
    }
  }
  const point = node => {
    const a = anchors.get(node.id);
    return a && ['observed', 'assumed', 'simulated', 'derived'].includes(a.provenance?.kind) &&
      typeof a.provenance.source === 'string' && a.provenance.source.length &&
      [a.x, a.z].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100000) ? {x: a.x, z: a.z, provenance: a.provenance} : null;
  };
  const valid = [];
  for (const edge of data.edges) {
    const from = nodes.get(edge.fromId), to = nodes.get(edge.toId);
    if (!from?.id.startsWith('event:') || !to?.id.startsWith('event:') || !sameScope(from.context, scope) || !sameScope(to.context, scope) ||
        !sameScope(edge.context, scope) || !Number.isFinite(from.context.tick) || !Number.isFinite(to.context.tick) || from.context.tick > to.context.tick ||
        !['causes', 'contributes', 'constrains'].includes(edge.relation) || !edge.evidenceIds?.length || edge.evidenceIds.length > INPUT_LIMIT || !edge.evidenceIds.every(id => evidence.has(id))) {
      notices.add('Unsupported, non-event, or unavailable dependency omitted; no link inferred.'); continue;
    }
    valid.push({edge, from, to});
  }
  // Only the component attached to this selection belongs to its itinerary.
  const connected = new Set([data.targetId]);
  for (let i = 0; i < records.length; i++) {
    let changed = false;
    for (const {from, to} of valid) if (connected.has(from.id) || connected.has(to.id)) {
      if (!connected.has(from.id) || !connected.has(to.id)) changed = true;
      connected.add(from.id); connected.add(to.id);
    }
    if (!changed) break;
  }
  const eligible = valid.filter(({from, to}) => connected.has(from.id) && connected.has(to.id))
    .sort((a, b) => a.from.context.tick - b.from.context.tick || a.edge.id.localeCompare(b.edge.id));
  if (eligible.length > PATH_LIMIT) notices.add('Path preview limited to 32 recorded connections.');
  const segments = eligible.slice(0, PATH_LIMIT).map(({edge, from, to}) => {
    const start = point(from), end = point(to);
    return {id: edge.id, eventIds: [from.id, to.id], evidenceIds: [...edge.evidenceIds], relation: edge.relation,
      from, to, start, end, kind: start && end ? 'segment' : 'jump',
      reason: start && end ? null : 'Jump — location unavailable; no street inferred.'};
  });
  if (!segments.length) notices.add('No supported recorded event connections available.');
  return {segments, records, notices: [...notices]};
}
