/** Browser-safe, dependency-free strict wire validation. No coercion or unknown keys. */
export const CONTRACT_VERSION = 1;
export const IFRAME_CHANNEL = 'hbl:causality';
const fail = message => { throw new TypeError(message); };
const str = v => typeof v === 'string' && v.length > 0 && v.length <= 4096 || fail('Expected bounded nonempty string');
const num = v => typeof v === 'number' && Number.isFinite(v) || fail('Expected finite number');
const tick = v => num(v) && Number.isSafeInteger(v) && v >= 0 || fail('Expected nonnegative safe integer');
const one = values => v => values.includes(v) || fail('Unsupported enum value');
const optional = validator => Object.assign(v => v === undefined || validator(v), { optional: true });
const array = validator => v => Array.isArray(v) && v.length <= 10000 && v.every(validator) || fail('Invalid array');
const object = fields => v => {
 if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail('Expected plain object');
 for (const key of Object.keys(v)) if (!Object.hasOwn(fields, key)) fail('Unknown field: ' + key);
 for (const [key, check] of Object.entries(fields)) { if (!Object.hasOwn(v,key) && !check.optional) fail('Missing field: ' + key); check(v[key]); }
 return true;
};
const json = (v, depth = 0) => {
 if (depth > 32) fail('JSON nesting too deep');
 if (v === null || typeof v === 'boolean' || typeof v === 'string') return true;
 if (typeof v === 'number') return num(v);
 if (Array.isArray(v)) return v.length <= 10000 && v.every(x => json(x,depth+1)) || fail('JSON array too large');
 if (!v || typeof v !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(v))) fail('Expected JSON');
 return Object.entries(v).every(([k,x]) => !['__proto__','constructor','prototype'].includes(k) && json(x,depth+1)) || fail('Unsafe JSON key');
};
const token = v => typeof v === 'string' && /^[a-z][a-z0-9_-]*$/.test(v) || fail('Invalid ID token');
export function canonicalId(kind, namespace, localId) { token(kind); token(namespace); str(localId); return `${kind}:${namespace}:${encodeURIComponent(localId)}`; }
export function parseCanonicalId(value) {
 str(value); const parts = value.split(':'); if(parts.length !== 3) fail('Invalid canonical ID');
 const [kind, namespace, encoded] = parts; token(kind); token(namespace);
 let localId; try { localId = decodeURIComponent(encoded); } catch { fail('Invalid ID encoding'); }
 if(canonicalId(kind,namespace,localId) !== value) fail('Noncanonical ID encoding');
 return { kind, namespace, localId };
}
const id = v => !!parseCanonicalId(v);
const schema = check => Object.freeze({ parse(input) { check(input); return structuredClone(input); }, safeParse(input) { try { return {success:true,data:this.parse(input)}; } catch(error) { return {success:false,error}; } } });
const universe = { universeId:id, worldId:id, scenarioId:id };
const run = {...universe,runId:id,seed:tick,modelVersion:str,tick,parentRunId:optional(id)};
const context = object(run);
const navigation = {...universe,experimentId:optional(id),runId:optional(id),branchId:optional(id),tick:optional(tick),entityId:optional(id)};
export const NavigationContextSchema = schema(object(navigation));
const provenance = object({id,kind:one(['observed','simulated','assumed','derived']),source:str,modelVersion:str,sourceIds:array(id)});
const event = object({id,context,sequence:tick,type:str,entityIds:array(id),payload:json,provenance});
const observation = object({id,context,sequence:tick,entityId:id,metricId:id,value:num,unit:str,provenance});
const assumption = object({id,context,sequence:tick,label:str,value:json,rationale:str,provenance});
const edge = object({id,context,fromId:id,toId:id,relation:one(['causes','contributes','constrains','correlates']),confidence:v=>num(v) && v>=0 && v<=1 || fail('Invalid confidence'),evidenceIds:array(id),provenance});
const parameters = v => { json(v); if(!v || Array.isArray(v) || typeof v !== 'object') fail('Expected parameters'); return true; };
const intervention = object({id,context,action:str,targetId:id,parameters});
export function sameRun(a,b) { return ['universeId','worldId','scenarioId','runId','seed','modelVersion'].every(k=>a[k]===b[k]); }
const snapshot = v => {
 object({context,events:array(event),observations:array(observation),assumptions:array(assumption),edges:array(edge)})(v);
 const seen = new Set(); for(const row of [...v.events,...v.observations,...v.assumptions,...v.edges]) { if(!sameRun(v.context,row.context) || row.context.tick > v.context.tick) fail('Snapshot context mismatch'); if(seen.has(row.id)) fail('Duplicate record ID'); seen.add(row.id); } return true;
};
export const UniverseContextSchema = schema(object(universe));
export const RunContextSchema = schema(context);
export const ProvenanceSchema = schema(provenance);
export const EventSchema = schema(event);
export const CausalEventSchema = EventSchema;
export const ObservationSchema = schema(observation);
export const AssumptionSchema = schema(assumption);
export const EdgeSchema = schema(edge);
export const CausalEdgeSchema = EdgeSchema;
export const InterventionSchema = schema(intervention);
export const CausalSnapshotSchema = schema(snapshot);
export const MetricDefinitionSchema = schema(object({id,label:str,unit:str,aggregation:one(['sum','mean','min','max','last','count']),description:optional(str)}));
export const LocalIdMappingSchema = schema(v => { object({namespace:token,kind:token,localId:str,canonicalId:id})(v); if(canonicalId(v.kind,v.namespace,v.localId)!==v.canonicalId) fail('Mapping mismatch'); return true; });
export function createLocalIdMap(mappings = []) {
 const forward = new Map(), reverse = new Map();
 return Object.freeze({ register(input) { const m=LocalIdMappingSchema.parse(input); const key=JSON.stringify([m.kind,m.namespace,m.localId]); if(forward.has(key) && forward.get(key)!==m.canonicalId || reverse.has(m.canonicalId) && reverse.get(m.canonicalId)!==key) fail('Conflicting mapping'); forward.set(key,m.canonicalId); reverse.set(m.canonicalId,key); return m.canonicalId; }, resolve(kind,namespace,localId) { return forward.get(JSON.stringify([kind,namespace,localId])) ?? null; }, local(canonical) { const key=reverse.get(canonical); return key ? JSON.parse(key)[2] : null; }, ...(() => { for(const m of mappings) { LocalIdMappingSchema.parse(m); const key=JSON.stringify([m.kind,m.namespace,m.localId]); forward.set(key,m.canonicalId); reverse.set(m.canonicalId,key); } return {}; })() });
}
export function createMetricRegistry(definitions = []) {
 const entries=new Map();
 const register = input => { const m=MetricDefinitionSchema.parse(input); if(entries.has(m.id)) fail('Metric already registered'); entries.set(m.id,Object.freeze(m)); return m; };
 definitions.forEach(register);
 return Object.freeze({register,get:id=>entries.get(id) ?? null,list:()=>[...entries.values()],validateObservation(input) { const row=ObservationSchema.parse(input), metric=entries.get(row.metricId); if(!metric || metric.unit!==row.unit) fail('Unknown metric or incompatible unit'); return row; }});
}
export function validateIntervention(input, allowlist, expectedContext) {
 const value=InterventionSchema.parse(input); context(expectedContext);
 if(!sameRun(value.context,expectedContext) || value.context.tick!==expectedContext.tick) fail('Stale or foreign intervention');
 const rules=allowlist.filter(r=>r.action===value.action); if(rules.length!==1) fail('Action must be explicitly allowlisted once');
 const rule=rules[0]; if(!rule.targetKinds.includes(parseCanonicalId(value.targetId).kind)) fail('Target kind forbidden');
 const keys=Object.keys(rule.parameters); if(keys.length!==Object.keys(value.parameters).length || keys.some(k=>!Object.hasOwn(value.parameters,k))) fail('Parameters must exactly match allowlist');
 for(const key of keys) { const r=rule.parameters[key], v=value.parameters[key]; if(r.type==='number') { num(v); if(!Number.isFinite(r.min)||!Number.isFinite(r.max)||r.min>r.max||v<r.min||v>r.max) fail('Number outside allowlist'); } else if(r.type==='boolean') { if(typeof v!=='boolean') fail('Expected boolean'); } else if(r.type==='string') { if(typeof v!=='string'||!r.values.includes(v)) fail('Value outside allowlist'); } else fail('Unsupported parameter rule'); }
 return value;
}
export const IframeMessageSchema = schema(v => {
 const common={version:one([1]),channel:one([IFRAME_CHANNEL]),requestId:str,context: ['ready','context','select','navigate','error'].includes(v?.type) ? object(navigation) : context};
 const variants={ready:{},context:{},select:{entityId:id},navigate:{experienceId:str,entityId:optional(id)},snapshot:{snapshot},intervene:{intervention},error:{code:str,message:str}};
 if(!v || !Object.hasOwn(variants,v.type)) fail('Unknown message type');
 object({...common,type:one([v.type]),...variants[v.type]})(v);
 const nested=v.snapshot?.context ?? v.intervention?.context; if(nested && (!sameRun(v.context,nested)||v.context.tick!==nested.tick)) fail('Message context mismatch'); return true;
});
/** Caller must supply exact expected origin AND iframe.contentWindow. Never use wildcard origins. */
export function parseIframeEvent(event, {origin, source, context: expectedContext}) {
 if(!origin || origin==='*' || origin==='null' || event.origin!==origin || !source || event.source!==source) fail('Untrusted iframe source');
 const value=IframeMessageSchema.parse(event.data); if(expectedContext && (!sameRun(value.context,expectedContext)||value.context.tick!==expectedContext.tick)) fail('Foreign message context'); return value;
}

export const CheckpointSchema = schema(object({id,context,sequence:tick,state:json,hash:str,replayMode:one(['recorded','verified'])}));
export function encodeUniverseContext(input) {
 const value=UniverseContextSchema.parse(input); const query=new URLSearchParams(); for(const [key,v] of Object.entries(value)) query.set(key,v); return query.toString();
}
export function decodeUniverseContext(input) {
 const query=new URLSearchParams(input); const value={}; for(const key of ['universeId','worldId','scenarioId']) { if(query.getAll(key).length!==1) fail('Missing or duplicate context key'); value[key]=query.get(key); } return UniverseContextSchema.parse(value);
}

export function encodeNavigationContext(input) { const value=NavigationContextSchema.parse(input); return new URLSearchParams(Object.entries(value).map(([k,v])=>[k,String(v)])).toString(); }
export function decodeNavigationContext(input) {
 const query=new URLSearchParams(input), value={}; for(const key of Object.keys(navigation)) { const values=query.getAll(key); if(values.length>1) fail('Duplicate context key'); if(values.length) { if(key==='tick' && !/^(0|[1-9][0-9]*)$/.test(values[0])) fail('Invalid tick'); value[key]=key==='tick'?Number(values[0]):values[0]; } } return NavigationContextSchema.parse(value);
}
