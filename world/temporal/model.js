import { createHash } from 'node:crypto';
export const SCHEMA_VERSION = 1;
export const ATTIC_MIN = '2012-09-12T06:56:00.000Z';
export const MAX_FEATURES = 2000;
export const ATTRIBUTION = '© OpenStreetMap contributors · ODbL';
export function fail(message, status=400) { const error = new Error(message); error.status=status; throw error; }
export function snapshotInput(params, now = new Date()) {
  const lat = Number(params.get('lat')), lng = Number(params.get('lng')), radiusM=Number(params.get('radiusM') || 200);
  if (!params.has('lat') || !params.has('lng') || !Number.isFinite(lat) || Math.abs(lat)>85 || !Number.isFinite(lng) || Math.abs(lng)>180) fail('lat/lng must be finite coordinates (latitude within ±85).');
  if (!Number.isFinite(radiusM) || radiusM<100 || radiusM>400) fail('radiusM must be between 100 and 400 metres.');
  const raw=params.get('date');
  if (!raw || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(raw)) fail('date must be an ISO UTC date or timestamp.');
  const date=new Date(raw);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==raw.slice(0,10)) fail('Invalid calendar date.');
  if (date < new Date(ATTIC_MIN)) fail(`Historical snapshots begin ${ATTIC_MIN}; earlier full-city coverage is unavailable.`);
  if (date > now) fail('Snapshot date cannot be in the future.');
  const dy=radiusM/111320, dx=dy/Math.cos(lat*Math.PI/180);
  if (lng-dx < -180 || lng+dx >180) fail('Dateline-crossing areas are unsupported.');
  return {date:date.toISOString(),origin:{lat,lng},radiusM,bounds:{south:lat-dy,west:lng-dx,north:lat+dy,east:lng+dx}};
}
export function sanitizeTags(tags={}) {
  return Object.fromEntries(Object.entries(tags).filter(([k,v])=>typeof v==='string' && k.length<=255 && v.length<=4096 && !/^(created_by|source:username|user|uid)$/.test(k)));
}
export function temporalEvidence(tags={}, meta={}) {
  const builtAt=tags.construction_date || tags.year_of_construction || null;
  return {builtAt,openedAt:tags.start_date||tags.opening_date||null,demolishedAt:tags.demolition_date||null,endOfUse:tags.end_date||null,
    osmFirstSeen:meta.version===1 ? meta.timestamp||null : null,osmLastModified:meta.timestamp||null,
    builtAtSource:tags.construction_date?'construction_date':tags.year_of_construction?'year_of_construction':null,
    confidence:builtAt || tags.start_date || tags.opening_date || tags.demolition_date ? 'tagged-unverified' : 'unknown',
    semantics:'OSM timestamps describe mapping edits, not construction. start_date describes opening/completion; end_date describes end of use, not proven demolition.'};
}
const coord = p => p && Number.isFinite(p.lon) && Number.isFinite(p.lat) ? [p.lon,p.lat] : null;
const same=(a,b)=>a && b && a[0]===b[0] && a[1]===b[1];
function rings(members,role) {
  const segments=members.filter(m=>m.type==='way' && (m.role||'outer')===role).map(m=>(m.geometry||[]).map(coord)).filter(a=>a.length>=2 && a.every(Boolean));
  const result=[];
  while(segments.length) {
    const ring=segments.shift();
    while(!same(ring[0],ring.at(-1))) {
      const i=segments.findIndex(s=>same(ring.at(-1),s[0]) || same(ring.at(-1),s.at(-1)));
      if(i<0) return null;
      const s=segments.splice(i,1)[0]; if(!same(ring.at(-1),s[0])) s.reverse(); ring.push(...s.slice(1));
    }
    if(ring.length<4) return null; result.push(ring);
  }
  return result;
}
function inside(point,ring) { let hit=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j]; if((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) hit=!hit;} return hit; }
export function geometryOf(element) {
  if(element.type==='node') { const p=coord(element);return p?{type:'Point',coordinates:p}:null; }
  if(element.type==='way') {
    const p=(element.geometry||[]).map(coord); if(p.length<2 || !p.every(Boolean)) return null;
    return same(p[0],p.at(-1)) && p.length>=4 ? {type:'Polygon',coordinates:[p]} : {type:'LineString',coordinates:p};
  }
  if(element.type==='relation') {
    if(element.members?.some(m=>m.type==='relation' || (m.type==='way' && !['','outer','inner'].includes(m.role||'')))) return null;
    const outer=rings(element.members||[],'outer'),inner=rings(element.members||[],'inner');
    if(!outer?.length || !inner) return null;
    const polygons=outer.map(r=>[r]);
    for(const hole of inner){const index=outer.findIndex(r=>inside(hole[0],r));if(index<0)return null;polygons[index].push(hole);}
    return polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
  }
  return null;
}
export function normalizeFeature(e) {
  const tags=sanitizeTags(e.tags), geometry=geometryOf(e);
  return {id:`${e.type[0]}${e.id}`,osmType:e.type,osmId:String(e.id),kind:tags.building?'building':tags.leisure?'park':tags.highway?'road':tags.shop?'shop':tags.amenity||'place',geometry,
    geometryStatus:geometry?'available':'unsupported-or-missing',tags,version:e.version??null,timestamp:e.timestamp??null,changeset:e.changeset??null,temporal:temporalEvidence(tags,e)};
}
export function snapshotFrom(payload,input,endpoint) {
  if(payload.remark) fail(`Historical query incomplete: ${payload.remark}`,502);
  if(!Array.isArray(payload.elements)) fail('Invalid historical map response.',502);
  if(payload.elements.length>MAX_FEATURES) fail(`Area exceeds ${MAX_FEATURES} features. Use a smaller radius.`,422);
  const features=payload.elements.filter(e=>['node','way','relation'].includes(e.type)).map(normalizeFeature);
  const id=createHash('sha256').update(JSON.stringify({input,features})).digest('hex').slice(0,24);
  return {schemaVersion:SCHEMA_VERSION,id,...input,features,attribution:ATTRIBUTION,
    provenance:{source:'OpenStreetMap / Overpass attic',endpoint,requestedDate:input.date,osmBaseTimestamp:payload.osm3s?.timestamp_osm_base||null,fetchedAt:new Date().toISOString(),historicalGeometry:true,interpretation:'Snapshot of what was mapped at this date; not a complete reconstruction of physical history.'},
    coverage:{status:features.some(f=>!f.geometry)?'partial-geometry':'query-complete',featureCount:features.length,maxFeatures:MAX_FEATURES,unsupportedGeometry:features.filter(f=>!f.geometry).map(f=>f.id),physicalCompleteness:'unknown',missingFeaturesAreNotProofOfAbsence:true}};
}
export function snapshotDiff(before,after) {
  if(JSON.stringify(before.bounds)!==JSON.stringify(after.bounds)) fail('Compare snapshots of the same geographic bounds.');
  if(before.date>after.date) fail('before must be earlier than after.');
  const a=new Map(before.features.map(f=>[f.id,f])),b=new Map(after.features.map(f=>[f.id,f])),events=[];
  for(const id of new Set([...a.keys(),...b.keys()])) {
    const old=a.get(id),next=b.get(id); let type;
    if(!old) type='mapping-added'; else if(!next) type='mapping-removed'; else if(JSON.stringify([old.tags,old.geometry,old.version])!==JSON.stringify([next.tags,next.geometry,next.version])) type='mapping-changed';
    if(type) events.push({id:`${before.id}:${after.id}:${id}`,type,featureId:id,before:old||null,after:next||null,date:after.date,physicalInterpretation:'unverified'});
  }
  return {schemaVersion:SCHEMA_VERSION,before:before.id,after:after.id,events,counts:Object.fromEntries(['mapping-added','mapping-removed','mapping-changed'].map(t=>[t,events.filter(e=>e.type===t).length])),interpretation:'Differences in mapped objects, not verified physical construction or demolition.'};
}
export function normalizeHistory(elements,type,id) {
  const versions=elements.filter(e=>e.type===type && String(e.id)===String(id)).sort((a,b)=>a.version-b.version).map(e=>({version:e.version,timestamp:e.timestamp||null,changeset:e.changeset||null,visible:e.visible!==false,tags:sanitizeTags(e.tags),nodes:e.nodes||null,members:e.members?.map(m=>({type:m.type,ref:m.ref,role:m.role}))||null,geometry:e.type==='node'?geometryOf(e):null,geometryStatus:e.type==='node'?'available':'historical-node-coordinates-unavailable',temporal:temporalEvidence(e.tags,e)}));
  return {schemaVersion:SCHEMA_VERSION,id:`${type[0]}${id}`,osmType:type,osmId:String(id),osmFirstSeen:versions.find(v=>v.version===1)?.timestamp||null,versions,attribution:ATTRIBUTION,provenance:{source:'OpenStreetMap object history',endpoint:`https://api.openstreetmap.org/api/0.6/${type}/${id}/history.json`,fetchedAt:new Date().toISOString(),interpretation:'Object edit versions; edit time is not construction time. Redacted versions may be absent.'}};
}
