/** Rendering projection only. Never joins City identities to another model. */
export const LAYOUT_VERSION = 'future-machine-layout.v1';
const key = (kind, id) => `${kind}:${id}`;
function rows(state, name) {
  if (!state || !Array.isArray(state[name])) throw new TypeError(`Missing City ${name}`);
  const ids = new Set();
  for (const row of state[name]) {
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new TypeError(`Invalid ${name} identity`);
    ids.add(row.id);
  }
  return state[name];
}
function footprint(b) {
  const rings = b.geometry?.coordinates;
  if (b.source !== 'osm' || !b.sourceId || b.geometry?.type !== 'Polygon' || rings?.length !== 1) return null;
  const ring = rings[0];
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(p => Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85)) return null;
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return null;
  return ring;
}
/** Stable, explicitly nongeographic slots persist across scrub and A/B frames. */
export function createSpatialMapping() {
  const slots = new Map();
  let origin = null;
  function project(ring) {
    origin ||= [...ring[0]];
    return ring.slice(0, -1).map(([lng, lat]) => [(lng - origin[0]) * 111320 * Math.cos(origin[1] * Math.PI / 180), -(lat - origin[1]) * 111320]);
  }
  return {
    version: LAYOUT_VERSION,
    frame(a, b) {
      if (!Number.isInteger(a?.month) || a.month !== b?.month) throw new TypeError('Scenes require matched City months');
      const buildings = [rows(a, 'buildings'), rows(b, 'buildings')];
      const projects = [rows(a, 'projects'), rows(b, 'projects')];
      const all = [...buildings.flat().map(row => key('buildings', row.id)), ...projects.flat().filter(p => p.type === 'housing' && p.stage !== 'completion' && p.stage !== 'abandoned').map(row => key('projects', row.id))];
      for (const id of [...new Set(all)].sort()) if (!slots.has(id)) slots.set(id, slots.size);
      // Duplicate source identities cannot establish an unambiguous footprint mapping.
      const ambiguous = new Set();
      for (const list of buildings) {
        const seen = new Set();
        for (const row of list) if (row.sourceId) { if (seen.has(String(row.sourceId))) ambiguous.add(String(row.sourceId)); seen.add(String(row.sourceId)); }
      }
      const mapped = buildings.map(list => list.map(row => {
        const ring = !ambiguous.has(String(row.sourceId)) && footprint(row);
        const polygon = ring ? project(ring) : null;
        const slot = slots.get(key('buildings', row.id));
        return {collection: 'buildings', id: row.id, record: row, mapping: polygon ? 'sourced-footprint' : 'synthetic-layout', polygon,
          // Synthetic inventory is a separate schematic, never placed onto sourced geography.
          x: polygon ? polygon.reduce((n,p)=>n+p[0],0)/polygon.length : (slot % 10) * 24,
          z: polygon ? polygon.reduce((n,p)=>n+p[1],0)/polygon.length : Math.floor(slot / 10) * 24,
          height: Math.max(1, Math.min(200, Number.isFinite(row.floors) ? row.floors : 1)) * 3,
          heightSource: 'illustrative 3m per recorded floor'};
      }));
      for (const [side, list] of projects.entries()) for (const row of list) {
        if (row.type !== 'housing' || ['completion','abandoned'].includes(row.stage)) continue;
        if (!Number.isFinite(row.progress) || !Number.isFinite(row.duration) || row.duration <= 0) continue;
        const slot = slots.get(key('projects', row.id));
        mapped[side].push({collection:'projects',id:row.id,record:row,mapping:'synthetic-layout',polygon:null,x:(slot%10)*24,z:Math.floor(slot/10)*24,height:3,progress:Math.max(0,Math.min(1,row.progress/row.duration))});
      }
      // Separate schematic inventory spatially from any sourced footprint extent.
      const sourced = mapped.flat().filter(r=>r.polygon);
      const offset = sourced.length ? Math.max(...sourced.flatMap(r=>r.polygon.map(p=>p[0]))) + 80 : 0;
      for (const r of mapped.flat()) if (!r.polygon) r.x += offset;
      const physical = mapped[0].filter(r=>r.collection==='buildings').map(r=>r.id).sort().join('\0') !== mapped[1].filter(r=>r.collection==='buildings').map(r=>r.id).sort().join('\0') || mapped[0].some(r=>r.collection==='buildings' && mapped[1].some(s=>s.id===r.id && (s.height!==r.height || JSON.stringify(s.polygon)!==JSON.stringify(r.polygon))));
      return {month:a.month,a:mapped[0],b:mapped[1],physicalDifference:physical,label:sourced.length ? 'OpenStreetMap footprints; separate synthetic layout for unlocated City inventory. Heights are illustrative.' : 'Synthetic layout · City inventory schematic, not real geography. Heights are illustrative.'};
    },
  };
}
