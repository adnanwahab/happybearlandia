/** Spatial read boundary v1. No simulation stepping, RNG or mutable source references. */
export const SCHEMA_VERSION = 'city-xray.frame.v1';
export const LIMITS = Object.freeze({ intersections: 4096, roads: 8192, entities: 20000, metrics: 16, samples: 40000, path: 256, symbols: 20000 });
const fail = message => { throw new TypeError(`City X-Ray: ${message}`); };
const str = (v, name) => typeof v === 'string' && v.length > 0 && v.length <= 256 || fail(name);
const num = (v, name) => typeof v === 'number' && Number.isFinite(v) || fail(name);
const integer = (v, max, name) => Number.isSafeInteger(v) && v >= 0 && v <= max || fail(name);
const equal = (a,b,name) => canonical(a) === canonical(b) || fail(name);
const list = (v,max,name) => Array.isArray(v) && v.length <= max || fail(name);
const point = p => { list(p,3,'position'); if(p.length!==3) fail('position dimension'); p.forEach(v=>{num(v,'coordinate'); if(Math.abs(v)>1e7) fail('coordinate bounds');}); };
export function canonical(value) {
 if(value === null || typeof value !== 'object') return JSON.stringify(value);
 if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
 return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
const utf8 = new TextEncoder();
function jsonOnly(value, seen=new Set(), depth=0, budget={nodes:0,bytes:0}) {
 const charge = count => { budget.bytes+=count; if(budget.bytes>12_000_000) fail('frame byte budget'); };
 if(++budget.nodes>1_000_000) fail('frame node budget');
 if(depth>32) fail('depth');
 if(value===null || typeof value==='boolean'){charge(value===false?5:4);return;}
 if(typeof value==='string'){if(value.length>4096) fail('string budget');charge(utf8.encode(JSON.stringify(value)).byteLength);return;}
 if(typeof value==='number'){num(value,'finite JSON');charge(JSON.stringify(value).length);return;}
 if(typeof value!=='object' || seen.has(value)) fail('plain JSON required');
 const array=Array.isArray(value);
 if(!array && Object.getPrototypeOf(value)!==Object.prototype) fail('plain object required');
 const ownKeys=Reflect.ownKeys(value),keys=Object.keys(value);
 if(ownKeys.some(key=>typeof key==='symbol')) fail('symbol keys');
 if(array){
  if(keys.length!==value.length || keys.some((key,index)=>key!==String(index))) fail('dense arrays required');
  if(ownKeys.length!==value.length+1) fail('plain JSON array required');
 }else if(ownKeys.length!==keys.length) fail('enumerable JSON fields required');
 if(keys.length>80000) fail('object budget');
 charge(2+Math.max(0,keys.length-1));
 seen.add(value);
 for(const key of keys){
  if(key.length>4096) fail('key budget');
  if(!array) charge(utf8.encode(JSON.stringify(key)).byteLength+1);
  const d=Object.getOwnPropertyDescriptor(value,key);if(!d || !('value' in d)) fail('accessor');
  jsonOnly(d.value,seen,depth+1,budget);
 }
 seen.delete(value);
}
const freeze = value => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);} return value; };
export function readFrame(input, expected = {}) {
 jsonOnly(input);
 const f=structuredClone(input);
 if(f.schemaVersion!==SCHEMA_VERSION) fail('schema version');
 for(const key of ['engine','model','run','source']){str(f.identity?.[key]?.id,key);str(f.identity[key].version,`${key} version`);}
 integer(f.seed,0xffffffff,'seed');
 for(const [key,value] of Object.entries(expected)) equal(f[key],value,`expected ${key}`);
 const c=f.clock;
 if(!c || !['population','monthly-city','synthetic-demo'].includes(c.authority)) fail('clock authority');
 if(c.unit!== (c.authority==='monthly-city'?'month':'minute')) fail('clock unit');
 integer(c.value,1e9,'clock');integer(c.tick,1e9,'tick');str(c.checkpoint,'checkpoint');
 const xyz=f.coordinates;
 if(xyz?.frame!=='local-x-y-z' || xyz.units!=='model-unit' || xyz.axes!=='x-east,y-up,z-south') fail('coordinate frame/units');
 point(xyz.origin);str(xyz.id,'coordinate identity');
 if(!['synthetic-demonstration','recorded-model-result','observed-geometry'].includes(f.provenance?.kind)) fail('provenance');
 str(f.provenance.label,'provenance label');str(f.provenance.sourceRef,'source reference');
 equal(f.provenance.sourceRef,f.identity.source.id,'source join');
 integer(f.provenance.retention.limit,1e7,'retention');integer(f.provenance.retention.missingCount,1e7,'missing');
 str(f.provenance.retention.policy,'retention policy');
 const index=new Map();
 for(const kind of ['intersections','roads','entities']){
  list(f[kind],LIMITS[kind],kind);
  for(const row of f[kind]){str(row.id,'id');if(index.has(row.id)) fail('duplicate id');index.set(row.id,{kind,row});equal(row.runId,f.identity.run.id,'cross-run row');equal(row.coordinateId,xyz.id,'coordinate join');}
 }
 for(const row of f.intersections) point(row.position);
 for(const row of f.entities){point(row.position);if(row.kind!=='place') fail('unsupported entity kind');}
 for(const row of f.roads){
  list(row.intersectionIds,2,'road endpoints');if(row.intersectionIds.length!==2 || row.intersectionIds[0]===row.intersectionIds[1]) fail('road endpoints');
  list(row.path,LIMITS.path,'path');if(row.path.length<2) fail('path');row.path.forEach(point);
  row.intersectionIds.forEach((id,i)=>{if(index.get(id)?.kind!=='intersections') fail('intersection join');equal(row.path[i===0?0:row.path.length-1],index.get(id).row.position,'path endpoint');});
 }
 list(f.metrics,LIMITS.metrics,'metrics');list(f.samples,LIMITS.samples,'samples');
 const metrics=new Map();
 for(const m of f.metrics){str(m.id,'metric');if(metrics.has(m.id)) fail('duplicate metric');metrics.set(m.id,m);str(m.quantity,'quantity');str(m.units,'metric units');if(!['synthetic-symbols','residents','encounters'].includes(m.units)) fail('unsupported units');equal(m.clock,c,'metric clock');integer(m.missingCount,1e7,'metric missing');if(m.normalization?.method!=='fixed-linear') fail('normalization');num(m.normalization.min,'min');num(m.normalization.max,'max');if(m.normalization.min!==0 || m.normalization.max<=0) fail('normalization domain');str(m.semantics,'semantics');}
 const joins=new Set();
 for(const s of f.samples){
  const m=metrics.get(s.metricId);if(!m || !index.has(s.targetId)) fail('sample join');
  const key=JSON.stringify([s.metricId,s.targetId]);if(joins.has(key)) fail('duplicate sample');joins.add(key);
  equal(s.units,m.units,'sample units');equal(s.runId,f.identity.run.id,'sample run');
  if(s.value!==null){num(s.value,'sample');if(s.value<0 || s.value>m.normalization.max) fail('sample bounds');}
  if(s.representedCount!==null){num(s.representedCount,'represented count');if(s.representedCount<0 || m.units!=='residents' || s.value===null) fail('represented count semantics');}
 }
 for(const m of f.metrics) equal(f.samples.filter(s=>s.metricId===m.id&&s.value===null).length,m.missingCount,'missing count');
 list(f.supportedLayers,3,'layers');if(new Set(f.supportedLayers).size!==f.supportedLayers.length || f.supportedLayers.some(x=>!['roads','columns','particles'].includes(x))) fail('unsupported layer');
 integer(f.display?.symbolCount,LIMITS.symbols,'symbol budget');integer(f.display?.maxSymbols,LIMITS.symbols,'max symbols');if(f.display.symbolCount>f.display.maxSymbols) fail('display budget');
 if(f.display.symbolCount>f.samples.filter(s=>s.value!==null).length) fail('symbols exceed available samples');
 integer(f.display.maxColumns,8192,'column budget');str(f.display.symbolMeaning,'symbol meaning');
 return freeze(f);
}
export async function frameHash(frame) {
 const bytes=new TextEncoder().encode(canonical(readFrame(frame)));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
