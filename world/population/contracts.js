import { recordHistoryEvent } from "../activity-history.js";
/** Living City population1.1.0: synthetic persons, no identifiable people.
 * Worker contract: createPopulationModel(config,worldContext) -> mutable model;
 * stepPopulation(model,{tick,minutes,config?}) advances one monotone tick;
 * snapshotPopulation(model,{visibleLimit=500,selectedPersonId?}) returns bounded
 * plain rows + aggregate metrics/districts/cohorts/validation/provenance.
 * inspectPerson/inspectHousehold materialize ONE entity and bounded real traces.
 * serializePopulation/restorePopulation round-trip typed state + deterministic
 * counter RNG. Do NOT transfer model hot-array buffers out of the worker.
 * First release uses one authoritative model/worker: household moves, jobs and
 * district capacity share state. No independent-shard semantics are claimed.
 * worldContext.buildings coordinates provide locations ONLY; demographics and
 * district capacities/rents are assumptions unless explicitly supplied/provenanced.
 */
export const POPULATION_VERSION = "1.1.0";
export const POPULATION_CONFIG_VERSION = "population-config.v1";
export const ACTIVITIES = ["HOME", "WORK", "SCHOOL", "SHOPPING", "ERRAND", "DINING", "RECREATION", "HEALTHCARE", "TRANSIT", "OTHER"];
export const MODES = ["none", "walk", "bike", "car", "bus", "rail"];
export const AGE_BANDS = ["child", "adult", "senior"];
const p = (id,label,unit,value,min,max,step=1) => ({id,label,unit,type:"number",default:value,min,max,step,source:{type:"synthetic-assumption",confidence:"low"}});
export const populationParameters = [
  p("population","Synthetic people","people",10000,1,100000), p("seed","Population seed","integer",42,0,4294967295),
  p("representedPopulation","Represented population (0=one per agent)","people",0,0,10000000),
  p("householdSize","Mean household size","people/household",2.5,1,6,0.1), p("medianIncome","Target household median income","USD/year",72000,6000,300000,1000),
  p("incomeSpread","Log income dispersion","index",0.55,0,1.5,0.05), p("employmentRate","Adult employment target","fraction",0.75,0,1,0.01),
  p("baseRent","Monthly district rent","USD/month",1800,100,15000,50), p("rentMultiplier","Rent policy multiplier","multiplier",1,0.25,4,0.05),
  p("housingCapacityMultiplier","Housing capacity multiplier","multiplier",1,0.5,3,0.05), p("wageMultiplier","Wage policy multiplier","multiplier",1,0.2,3,0.05),
  p("transitService","Bus/rail service level","multiplier",1,0,4,0.1), p("roadCapacity","District vehicle capacity per step","vehicles",800,10,100000,10),
  p("transitCapacity","District transit capacity per step","riders",600,10,100000,10), p("carCostPerKm","Car trip cost","USD/km",0.35,0,3,0.05),
  p("transitFare","Transit fare","USD/trip",2.5,0,20,0.5), p("moveThreshold","Required move utility improvement","index",0.15,0,2,0.05),
  p("walkingSpeedKmh","Walking speed assumption","km/hour",2.4,1,7,0.1),
  p("flexibleActivityMinutes","Flexible activity commitment","minutes",45,15,120,5),
  p("needDecisionThreshold","Need-driven reconsideration threshold","points",35,10,70,1),
  p("movingCost","Household moving cost","USD",1500,0,20000,100), p("burdenThreshold","Housing stress threshold","fraction",0.35,0.1,0.9,0.01),
  p("displacementThreshold","Severe housing burden threshold","fraction",0.6,0.3,1.5,0.05), p("initialBufferMonths","Initial savings buffer","months",3,0,24,0.5),
  p("layoffRate","Daily baseline layoff probability","probability/day",0.0005,0,0.1,0.0005), p("hiringRate","Daily job-search success probability","probability/day",0.01,0,0.5,0.005),
  p("awarenessRate","Daily service awareness diffusion","fraction/day",0.08,0,1,0.01), p("businessTax","Business revenue tax","fraction",0.03,0,0.5,0.01),
  p("constructionDisruption","District access disruption","fraction",0,0,0.9,0.05), p("maxLogEntries","Global event retention","entries",400,10,2000),
];
export const defaultPopulationConfig = Object.fromEntries(populationParameters.map(row=>[row.id,row.default]));
export const DEFAULT_POPULATION_CONFIG = defaultPopulationConfig;
export const populationConfigSchema = {schemaVersion:POPULATION_CONFIG_VERSION,modelVersion:POPULATION_VERSION,parameters:populationParameters,
  events:["rent-increase","recession","road-closure","transit-outage","transit-opening","festival","storm","employer-opens","employer-closes"],
  limits:{maxPopulation:100000,maxDistricts:32,maxEvents:64,maxVisible:2000,maxGlobalLog:2000,maxEntityTrace:12},
  limitations:["Synthetic demographics and behavioral coefficients; not empirical calibration.","District/cohort transport, not microscopic routes or road-link simulation.","One authoritative state; no independent multiworker sharding.","Modeled utility is not objective happiness."]};
export function validatePopulationConfig(input={}) {
  const values={...defaultPopulationConfig},errors=[];
  if(!input||typeof input!=="object"||Array.isArray(input))return{valid:false,values,errors:["Config must be an object."]};
  for(const id of Object.keys(input))if(!populationParameters.some(row=>row.id===id)&&!["schemaVersion","snapshotId","provenance","events","targets","enabled"].includes(id))errors.push(`Unknown population parameter: ${id}`);
  for(const row of populationParameters)if(input[row.id]!==undefined){const v=input[row.id];if(typeof v!=="number"||!Number.isFinite(v)||v<row.min||v>row.max||(["population","seed","maxLogEntries"].includes(row.id)&&!Number.isInteger(v)))errors.push(`${row.id} must be ${row.min}–${row.max} ${row.unit}.`);else values[row.id]=v;}
  if(input.schemaVersion&&input.schemaVersion!==POPULATION_CONFIG_VERSION)errors.push("Unsupported population config version.");
  const events=input.events||[];
  if(!Array.isArray(events)||events.length>64)errors.push("At most64 scheduled events are supported.");
  else for(const event of events)if(!event||!populationConfigSchema.events.includes(event.type)||!Number.isFinite(event.startMinute)||event.startMinute<0||!Number.isFinite(event.durationMinutes)||event.durationMinutes<=0||!Number.isFinite(event.magnitude)||event.magnitude<0||event.magnitude>1||!Number.isFinite(event.recoveryMinutes??0)||(event.recoveryMinutes??0)<0)errors.push("Events need a known type, startMinute>=0, durationMinutes>0, magnitude0–1 and recoveryMinutes>=0.");
  return{valid:!errors.length,values:{...values,schemaVersion:POPULATION_CONFIG_VERSION,snapshotId:String(input.snapshotId||"illustrative-city.v1"),provenance:input.provenance||{type:"synthetic",confidence:"low"},events:structuredClone(Array.isArray(events)?events:[]),targets:input.targets?structuredClone(input.targets):null},errors};
}
export const POPULATION_CONFIG_SCHEMA = populationConfigSchema;
export function normalizePopulationConfig(input={}){const result=validatePopulationConfig(input);if(!result.valid)throw new Error(result.errors.join(" "));return result.values;}
export function hash(value){let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function draw(seed,index,tick,stream=0){let n=(seed^Math.imul(index+1,2654435761)^Math.imul(tick+1,2246822519)^Math.imul(stream+1,3266489917))>>>0;n=Math.imul(n^(n>>>16),2246822507);n=Math.imul(n^(n>>>13),3266489909);return((n^(n>>>16))>>>0)/4294967296;}
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function recordTrace(model,kind,index,trace){const key=`${kind}:${index}`;let rows=model.traces.get(key);if(!rows){rows=[];model.traces.set(key,rows);}rows.push({schemaVersion:"decision-event.v1",behaviorModelVersion:POPULATION_VERSION,id:`${model.prefix}-${kind}${index}-${trace.type}-${trace.minute}`,actorId:`${model.prefix}-${kind==="person"?"p":"h"}${index}`,reasonCodes:trace.reasonCodes||[],...trace});if(rows.length>12)rows.shift();if(model.traces.size>1024)model.traces.delete(model.traces.keys().next().value);}
export function recordEvent(model,type,detail={}){const event={schemaVersion:"event.v2",modelVersion:POPULATION_VERSION,id:`${model.prefix}-event-${Object.values(model.eventCounts).reduce((a,b)=>a+b,0)}`,tick:model.tick,minute:model.minute,type,synthetic:true,...detail};model.events.push(event);if(model.events.length>model.config.maxLogEntries)model.events.shift();model.eventCounts[type]=(model.eventCounts[type]||0)+1;if(model.activityHistory)recordHistoryEvent(model.activityHistory,{...event,weight:detail.weight??((detail.personId!=null||detail.householdId!=null)?model.weight||1:1)});}
