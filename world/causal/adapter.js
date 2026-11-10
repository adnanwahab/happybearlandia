import {canonicalId, RunContextSchema, CausalSnapshotSchema, createMetricRegistry, validateIntervention, parseCanonicalId} from '../../shared/causality/index.js';
import {createEngine, addIntervention, cityMetrics} from '../city/engine.js';
import {cityEntityId} from './demo.js';
import {VERSION, validateState} from '../city/contracts.js';
const collections={districts:'district',parcels:'parcel',buildings:'building',units:'unit',households:'household',workers:'person',businesses:'business',jobs:'job',links:'link',facilities:'facility',utilities:'utility',projects:'project',policies:'policy'};
const units={population:'people',households:'households',housingUnits:'units',availableUnits:'units',meanRent:'modeled USD/month',unhoused:'households',employed:'people',jobs:'jobs',businesses:'businesses',meanTravelMinutes:'minutes',overloadedServices:'facilities',utilityFailures:'utilities',balance:'modeled USD',debt:'modeled USD',completedProjects:'projects'};
export const WORLD_INTERVENTIONS=Object.freeze([{action:'city-policy',targetKinds:['district'],parameters:{type:{type:'string',values:['housing','transit','utility','school','resilience','upzone']},amount:{type:'number',min:0.001,max:100000},cost:{type:'number',min:0,max:1e12}}}]);
/** Owns a detached monthly CityState. No timers, geometry inference, RNG draws, or legacy town writes. */
export function createWorldCausalAdapter({context,initialState}) {
 validateState(initialState);
 let state=structuredClone(initialState),base=RunContextSchema.parse(context);
 if(base.seed!==state.seed||base.tick!==state.month||base.modelVersion!==VERSION)throw new Error('City state/context mismatch');
 let sequence=0;
 const engine=createEngine(undefined,{trace:true}),events=[],observations=[],edges=[],mappings=new Map();
 const id=(kind,local)=>cityEntityId(base.worldId,kind,local);
 const entity=(collection,local)=>{const kind=collections[collection];if(!kind)throw new Error('Unsupported entity collection');const canonical=id(kind,local);mappings.set(canonical,{namespace:'world-city',kind,localId:`${base.worldId}/${local}`,canonicalId:canonical,collection,sourceLocalId:local});return canonical;};
 const ctx=()=>({...base,tick:state.month});
 const provenance=(local)=>({id:id('provenance',`${base.runId}/${local}`),kind:'simulated',source:'world/city/systems.js; recorded monthly model mechanism, not empirical causation',modelVersion:VERSION,sourceIds:[]});
 const registry=createMetricRegistry(Object.entries(units).map(([key,unit])=>({id:canonicalId('metric','world-city',key),label:key,unit,aggregation:key==='meanRent'||key==='meanTravelMinutes'?'mean':'last'})));
 function register(){for(const [collection,kind]of Object.entries(collections))for(const row of state[collection])entity(collection,row.id);}
 function emit(type,entityIds,payload){const ordinal=sequence++;const event={id:id('event',`${base.runId}/${ordinal}`),context:ctx(),sequence:ordinal,type,entityIds,payload,provenance:provenance(`event/${ordinal}`)};events.push(event);return event;}
 function observe(){for(const [key,value]of Object.entries(cityMetrics(state))){const row={id:id('observation',`${base.runId}/${state.month}/${key}`),context:ctx(),sequence:sequence++,entityId:base.worldId,metricId:canonicalId('metric','world-city',key),value,unit:units[key],provenance:provenance(`metric/${state.month}/${key}`)};observations.push(registry.validateObservation(row));}}
 register();observe();
 return {
  experienceId:'world',getManifest:()=>structuredClone({domain:'world-city',modelVersion:VERSION,systems:engine.manifest}),getContext:()=>structuredClone(ctx()),getState:()=>structuredClone(state),getEntities:()=>structuredClone([...mappings.values()]),getMetrics:()=>registry.list(),interventions:()=>structuredClone(WORLD_INTERVENTIONS),
  step(){const result=engine.step(state);state=result.state;register();
   for(const record of result.causalRecords){const entityId=entity(...record.entity),input=emit('MODEL_INPUTS',[entityId],{system:record.system,transition:record.type,values:record.inputs}),output=emit(record.type,[entityId],{system:record.system,values:record.outputs});edges.push({id:id('edge',`${base.runId}/${edges.length}`),context:ctx(),fromId:input.id,toId:output.id,relation:'contributes',confidence:1,evidenceIds:[input.id,output.id],provenance:provenance(`edge/${edges.length}`)});}
   for(const source of result.events)emit(source.eventType,[...(source.geographyId&&state.districts.some(d=>d.id===source.geographyId)?[entity('districts',source.geographyId)]:[])],{source});
   observe();return this.snapshot();},
  snapshot(){return CausalSnapshotSchema.parse({context:ctx(),events,observations,assumptions:[],edges});},
  async intervene(request){const value=validateIntervention(request,WORLD_INTERVENTIONS,ctx());const mapping=mappings.get(value.targetId);if(!mapping||mapping.collection!=='districts'||parseCanonicalId(value.targetId).kind!=='district')throw new Error('Unmapped district');state=addIntervention(state,{...value.parameters,districtId:mapping.sourceLocalId});register();emit('POLICY_PROPOSED',[value.targetId,entity('policies',state.policies.at(-1).id)],{requestId:value.id,parameters:value.parameters});return this.getContext();}
 };
}
