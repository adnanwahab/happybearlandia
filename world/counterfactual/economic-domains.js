import {canonicalId} from '../../shared/causality/index.js';
import {runLogistics} from '../../tools/flowmap/logistics.js';
import {logisticsBusinessInputs} from '../../tools/flowmap/business-connector.js';
import {advanceConnectedBusiness} from '../models/business-v1/external-adapter.js';
import {connectHouseholdEconomy} from '../house/economic-adapter.js';
import {ForkError} from './engine.js';
const required=(value,label)=>{if(!value)throw new ForkError(422,'mapping_required',`Explicit ${label} required`);return value;};
/** Explicit checkpoint envelope: {logistics:{input},business:{state,plan,entityId,demandIds},household:{input}}.
 * No adapters infer economic observations or geometry-to-network mappings. Horizon unit: business periods. */
export function createEconomicForkDomains(){return {
 logistics:{version:'flowmap-logistics/1',dependencies:[],interventions:[{action:'logistics.link-closure',targetKinds:['link'],parameters:{closed:{type:'boolean'}}}],
 async recompute({state,context,interventions}){const domain=required(state.logistics,'logistics checkpoint');domain.input.context=context;for(const intervention of interventions){const link=domain.input.links.find(l=>l.id===intervention.targetId);if(!link)throw new ForkError(422,'target_not_found','Link is absent from checkpoint');link.closed=intervention.parameters.closed;}domain.result=await runLogistics(domain.input);domain.snapshot={context,events:[],assumptions:[],edges:[],observations:domain.result.deliveries.map(d=>({id:canonicalId('observation','fork-logistics',`${context.runId}/${context.tick}/${d.demandId}`),context,entityId:canonicalId('shipment','fork-logistics',d.demandId),metricId:canonicalId('metric','fork-logistics','delivered'),value:d.delivered,unit:'count',provenance:{id:canonicalId('provenance','fork-logistics',domain.result.inputHash),kind:'simulated',source:'Explicit interval logistics model',modelVersion:'flowmap-logistics/1',sourceIds:interventions.map(i=>i.id)}}))};domain.observationIds=domain.snapshot.observations.map(o=>o.id);return state;}},
 business:{version:'business-v1',dependencies:['logistics'],interventions:[],
 async recompute({state,context,horizon,seed}){const b=required(state.business,'business checkpoint'),bridge=logisticsBusinessInputs(state.logistics.result,b.demandIds);if(b.state.period!==context.tick)throw new ForkError(409,'incompatible_checkpoint','Business checkpoint period must equal fork tick');b.state.seed=seed;for(let i=0;i<horizon;i++){const output=advanceConnectedBusiness(b.state,b.plan,{context,entityId:b.entityId,externalInputs:bridge.externalInputs,sourceIds:state.logistics.observationIds});b.state=output.state;b.employment=output.employment;b.snapshot=output.snapshot;b.report=output.report;}return state;}},
 household:{version:'household-economic.v1',dependencies:['business'],interventions:[],
 async recompute({state}){const h=required(state.household,'household mapping'),employment=state.business.employment;h.result=connectHouseholdEconomy({...h.input,employment,context:employment.context});return state;}}
};}
