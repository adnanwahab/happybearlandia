/** Transport metadata only. Authority must come from a destination's loaded state. */
export const CONTINUITY_VERSION = 'world-continuity.v1';
export const SURFACES = Object.freeze({world:'/world', 'future-machine':'/world/future-machine.html', decision:'/world/decision.html'});
export const CONTINUITY_KEY = 'continuity';
const fail = () => { throw new TypeError('Invalid continuity payload'); };
function record(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value,k))) fail();
}
function id(value) { if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\u0000-\u001f\u007f]/.test(value)) fail(); }
function vector(value) { if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) fail(); }
export function parseContinuity(value) {
  record(value,['version','sourceSurface','authority','runId','checkpointId','modelVersion','entity','camera','clock']);
  if(value.version !== CONTINUITY_VERSION || !Object.hasOwn(SURFACES,value.sourceSurface)) fail();
  for(const k of ['authority','runId','checkpointId','modelVersion']) id(value[k]);
  if(value.entity !== null) { record(value.entity,['namespace','kind','id']); for(const k of ['namespace','kind','id']) id(value.entity[k]); }
  if(value.camera !== null) {
    record(value.camera,['mapping','version','position','target']);id(value.camera.mapping);id(value.camera.version);vector(value.camera.position);vector(value.camera.target);
  }
  record(value.clock,['id','unit','origin','tick']);for(const k of ['id','unit','origin']) id(value.clock[k]);
  if(!Number.isSafeInteger(value.clock.tick) || value.clock.tick < 0) fail();
  return structuredClone(value);
}
export function readContinuity(input) {
  const url = new URL(input,'http://hbl.local');
  const values = url.searchParams.getAll(CONTINUITY_KEY);
  if(!values.length) return {status:'missing',payload:null};
  try {
    if(values.length !== 1 || values[0].length > 8192) fail();
    return {status:'carried',payload:parseContinuity(JSON.parse(values[0]))};
  } catch { return {status:'invalid',payload:null}; }
}
export function continuityURL(surface,payload) {
  if(!Object.hasOwn(SURFACES,surface)) throw new TypeError('Unsupported continuity destination');
  const url = new URL(SURFACES[surface],'http://hbl.local');
  if(payload !== null) url.searchParams.set(CONTINUITY_KEY,JSON.stringify(parseContinuity(payload)));
  return url.pathname + url.search;
}
const entityKey = entity => JSON.stringify([entity.namespace,entity.kind,entity.id]);
/** No conversion: equal ticks alone cannot prove equal clocks or identities. */
export function resolveContinuity(input, authority) {
  let payload;
  try { payload = parseContinuity(input); } catch { return {status:'invalid',payload:null}; }
  const unavailable = status => ({status,payload:null});
  if(!authority) return unavailable('unsupported');
  if(payload.authority !== authority.authority) return unavailable('authority-mismatch');
  if(payload.runId !== authority.runId || payload.checkpointId !== authority.checkpointId) return unavailable('stale');
  if(payload.modelVersion !== authority.modelVersion) return unavailable('model-mismatch');
  if(['id','unit','origin','tick'].some(k=>payload.clock[k] !== authority.clock?.[k])) return unavailable('clock-mismatch');
  if(payload.entity && !authority.entities?.some(e=>entityKey(e) === entityKey(payload.entity))) return unavailable('unresolved-entity');
  if(payload.camera && !authority.mappings?.some(m=>m.id === payload.camera.mapping && m.version === payload.camera.version)) return unavailable('unsupported-mapping');
  return {status:'compatible',payload};
}
