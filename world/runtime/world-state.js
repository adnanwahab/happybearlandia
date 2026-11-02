import {POPULATION_VERSION,normalizePopulationConfig,populationParameters} from '../population/contracts.js';
export const WORLD_VERSION='world-v2';
export const WORLD_RUNTIME_VERSION='world-runtime.1.0.0';
export const WORLD_LIMITS=Object.freeze({maxEvents:10000,maxCheckpoints:8,maxMetricRows:1000,maxSubsystems:16,maxSubscribers:64,maxPolicyHistory:64});
export const GENERATION_PARAMETERS=Object.freeze(['population','seed','snapshotId','householdSize','medianIncome','incomeSpread','employmentRate','representedPopulation','initialBufferMonths','baseRent','targets','provenance']);
export const cloneWorld=value=>structuredClone(value);
export function freezeWorld(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){if(ArrayBuffer.isView(value))return value;Object.freeze(value);for(const child of Object.values(value))freezeWorld(child);}return value;}
export function detachedWorld(value){return freezeWorld(cloneWorld(value));}
export function normalizeScenario(input={},config){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Scenario must contain validated population parameter inputs');
 const populationEnvelope=Object.hasOwn(input,'populationPatch'),envelope=Object.hasOwn(input,'parameters')||populationEnvelope||Object.hasOwn(input,'environmentPatch');
 if(Object.hasOwn(input,'parameters')&&populationEnvelope)throw new Error('Provide parameters or populationPatch, not both');
 if(envelope&&Object.keys(input).some(key=>!['id','label','parameters','populationPatch','environmentPatch','trace','provenance'].includes(key)))throw new Error('Unknown scenario field');
 let parameters=envelope?(populationEnvelope?input.populationPatch:input.parameters??{}):input;
 if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw new Error('Scenario parameters must be an object');
 const environmentPatch=input.environmentPatch??{};
 if(envelope&&(!environmentPatch||typeof environmentPatch!=='object'||Array.isArray(environmentPatch)||Object.keys(environmentPatch).some(key=>key!=='events')))throw new Error('Only scheduled population events are implemented environment inputs');
 if(envelope&&environmentPatch.events!==undefined&&parameters?.events!==undefined)throw new Error('Provide events in one parameter namespace');
 if(envelope&&input.trace!==undefined&&JSON.stringify(input.trace).length>32768)throw new Error('Scenario trace exceeds 32KiB');
 if(envelope)parameters={...parameters,...environmentPatch};
 if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw new Error('Scenario parameters must be an object');
 const permitted=new Set([...populationParameters.map(row=>row.id),'events']);
 for(const key of Object.keys(parameters)){if(!permitted.has(key))throw new Error(`Unknown scenario parameter: ${key}`);if(GENERATION_PARAMETERS.includes(key)&&JSON.stringify(parameters[key])!==JSON.stringify(config[key]))throw new Error(`${key} changes require an explicit world reset`);}
 const normalized=normalizePopulationConfig({...config,...parameters});
 const id=envelope?input.id??'scenario':'scenario',label=envelope?input.label??id:'Scenario';
 if(typeof id!=='string'||!id.length||id.length>128||typeof label!=='string'||label.length>200)throw new Error('Scenario id/label must be bounded strings');
 return{id,label,parameters:cloneWorld(parameters),trace:cloneWorld(envelope?input.trace??null:null),environmentPatch:cloneWorld(envelope?environmentPatch:{}),config:normalized,provenance:cloneWorld(input.provenance??{type:'explicit-model-parameter-input',calibrated:false})};
}
export function createOwnership(subsystems=[]){return{scope:'isolated-world-runtime',integrationMode:'shadow',liveWorldAuthority:'legacy until explicit ownership and parity gates pass',populationModelVersion:POPULATION_VERSION,domains:{residents:'population-model',households:'population-model',employment:'population-model/local-economy',income:'population-model',savings:'population-model',travel:'population-model',activities:'population-model',needs:'population-model',businesses:'population-model.economy',jobs:'population-model.economy',businessCash:'population-model.economy',environment:'population-model scheduled district effects; no migrated hydrology',infrastructure:'not migrated',policy:'validated population parameter inputs',clock:'population-model.minute',renderer:'read-only detached snapshots',...Object.fromEntries(subsystems.flatMap(system=>system.owns.map(domain=>[domain,system.id])))},economyAdvance:'stepPopulation invokes stepLocalEconomy once at actual model day boundaries; runtime never advances it separately',legacyWrites:false,parityGatePassed:false};}
