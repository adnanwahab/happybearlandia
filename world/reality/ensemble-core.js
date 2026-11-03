import {REALITY_CLOCK_ANCHOR,realityClock} from './clock.js';
export {REALITY_CLOCK_ANCHOR} from './clock.js';
import {ACTIVITIES} from '../population/contracts.js';
import {verifyRealityManifest,simulateRealityPair,REALITY_LIMITS} from './runtime-core.js';
export const REALITY_ENSEMBLE_LIMITS=Object.freeze({maxFutures:100,maxGeometryRecords:20000,maxGeometryVertices:200000});
const checked=(ok,message)=>{if(!ok)throw new Error(message);},cancelled=()=>Object.assign(new Error('Reality ensemble cancelled'),{name:'AbortError'}),yieldLoop=()=>new Promise(resolve=>setTimeout(resolve,0));
const accumulator=()=>({presentFutures:0,contributingRunIndices:[],units:{sum:0,min:Infinity,max:0},rent:{sum:0,observations:0,min:Infinity,max:-Infinity},currentStateCounts:{}});
function observeMetric(stats,value){stats.sum+=value;stats.min=Math.min(stats.min,value);stats.max=Math.max(stats.max,value);}
function finishArm(arm,n,city){return{...arm,presenceFrequency:arm.presentFutures/n,units:city?{...arm.units,min:arm.presentFutures<n?0:arm.units.min,mean:arm.units.sum/n,denominator:'All selected futures, including zero when absent',unit:'units'}:null,rent:{...arm.rent,min:arm.rent.observations?arm.rent.min:null,max:arm.rent.observations?arm.rent.max:null,mean:arm.rent.observations?arm.rent.sum/arm.rent.observations:null,unit:'USD/month per observed unit; not a mean across future means'},currentStateCountUnit:'Observed units by status (city), or onsite people by activity (population)'};}
/** Overlay snapshot contract: reality-ensemble.v1.
 * clock: {time,unit,anchor}; runs: [{runId,runIndex,seed}] is the contributor table.
 * records: [{id,buildingIds,sourceId,geometry,center,bbox,baseline,treatment}].
 * Each arm has presentFutures, presenceFrequency, contributingRunIndices (indices
 * into runs, not runIndex), units {sum,min,max,mean} (city only), rent stats,
 * and currentStateCounts. Frequency denominators are completedFutures.
 * Geometry stays supplied; null means no anchor, never a district centroid.
 * Replays one actual pair at a time. Only aggregates survive each iteration.
 */
export async function ensembleRealityFutures(result,{month,minute,maxFutures=100,maxGeometryRecords=20000,shouldCancel=()=>false,onProgress=()=>{}}={}){
 const manifest=verifyRealityManifest(result?.manifest),city=manifest.engine==='city';checked(city?minute===undefined:month===undefined,'Ensemble clock unit does not match engine');
 checked(Number.isInteger(maxFutures)&&maxFutures>=1&&maxFutures<=100,'Ensemble maxFutures must be 1–100');checked(Number.isInteger(maxGeometryRecords)&&maxGeometryRecords>=1&&maxGeometryRecords<=20000,'Ensemble geometry budget must be 1–20000');
 const time=(city?month:minute)??(city?manifest.months:manifest.minutes);checked(Number.isInteger(time)&&time>=0&&time<=(city?manifest.months:manifest.minutes),'Ensemble time must be an actual modeled checkpoint within the manifest horizon');
 checked(Array.isArray(result.runs)&&result.runs.length<=REALITY_LIMITS.maxRuns,'Invalid completed future catalog');
 const unique=new Set(),completed=[];for(const row of result.runs){if(row.status!=='completed')continue;checked(Number.isInteger(row.runIndex)&&row.runIndex>=0&&row.runIndex<manifest.runs&&row.runId===`${manifest.id}-future-${row.runIndex+1}`&&!unique.has(row.runIndex),'Ensemble requires unique actual completed run identities');unique.add(row.runIndex);completed.push(row);}
 completed.sort((a,b)=>a.runIndex-b.runIndex);const selected=completed.slice(0,maxFutures);checked(selected.length>0,'Ensemble requires an actually completed future');
 const work=selected.length*2*time*(city?Math.max(1,manifest.initial.households.length):manifest.initial.population);checked(work<=(city?REALITY_LIMITS.maxHouseholdMonths:REALITY_LIMITS.maxAgentMinutes),'Ensemble replay exceeds the engine workload budget');
 const geometry=new Map(),runs=[];let vertices=0,unlocatedBuildings=0,unlocatedUnits=0,unlocatedPeople=0;
 function record(building){const sourceId=building.sourceId??null,id=sourceId!==null?`source:${sourceId}`:`building:${building.id}`;let row=geometry.get(id);if(!row){checked(geometry.size<maxGeometryRecords,'Ensemble geometry exceeds its record budget; use a smaller frozen city');const shape=building.geometry??(building.poly?{type:'Polygon',coordinates:[building.poly]}:null),center=building.center??null;const count=shape?.coordinates?.flat(2)?.length??0;vertices+=count;checked(vertices<=REALITY_ENSEMBLE_LIMITS.maxGeometryVertices*2,'Ensemble geometry vertex budget exceeded');row={id,buildingIds:[],sourceId,geometry:shape?structuredClone(shape):null,center:center?structuredClone(center):null,bbox:building.bbox?structuredClone(building.bbox):null,baseline:accumulator(),treatment:accumulator()};geometry.set(id,row);}if(row.geometry&&building.geometry)checked(JSON.stringify(row.geometry)===JSON.stringify(building.geometry),'A stable footprint changed geometry across selected futures');if(!row.buildingIds.includes(String(building.id)))row.buildingIds.push(String(building.id));return row;}
 function consume(state,arm,index){
  const buildings=city?state.buildings:state.locations.map(location=>({...location,id:String(location.id),center:[location.x,location.z]})),local=new Map(),refs=new Map();
  for(const building of buildings){const row=record(building);refs.set(String(building.id),row.id);if(!local.has(row.id))local.set(row.id,{units:0,rents:[],states:{}});if(!row.geometry&&!row.center)unlocatedBuildings++;}
  if(city){for(const unit of state.units){const ref=refs.get(String(unit.buildingId)),row=local.get(ref);if(!row){unlocatedUnits++;continue;}row.units++;if(Number.isFinite(unit.rent))row.rents.push(unit.rent);row.states[unit.status]=(row.states[unit.status]??0)+1;}}
  else{for(let i=0;i<state.people.age.length;i++){const location=state.people.remaining[i]<=0?state.locations[state.people.currentLocation[i]]:null,ref=location?refs.get(String(location.id)):null,row=local.get(ref);if(!row){unlocatedPeople++;continue;}const activity=ACTIVITIES[state.people.activity[i]];row.states[activity]=(row.states[activity]??0)+1;}}
  for(const [id,value]of local){const armRow=geometry.get(id)[arm];armRow.presentFutures++;armRow.contributingRunIndices.push(index);observeMetric(armRow.units,value.units);for(const rent of value.rents){observeMetric(armRow.rent,rent);armRow.rent.observations++;}for(const [key,count]of Object.entries(value.states))armRow.currentStateCounts[key]=(armRow.currentStateCounts[key]??0)+count;}
 }
 onProgress({completed:0,total:selected.length,clock:{time,unit:city?'month':'minute'}});
 for(let index=0;index<selected.length;index++){
  if(shouldCancel())throw cancelled();const source=selected[index],pair=await simulateRealityPair(manifest,source.runIndex,{through:time,retain:'ensemble',shouldCancel});
  checked(pair.runId===source.runId&&pair.seed===source.seed,'Ensemble source seed/run identity changed');checked(JSON.stringify(pair.assumptions)===JSON.stringify(source.assumptions),'Ensemble source assumption grid changed');
  for(const arm of ['baseline','treatment']){const state=pair[arm].state;checked((city?state.month:state.minute)===time&&(city?state.seed:state.config.seed)===pair.seed,'Ensemble arms must share the requested clock and paired seed');consume(state,arm,index);}
  runs.push({runId:pair.runId,runIndex:pair.runIndex,seed:pair.seed});onProgress({completed:index+1,total:selected.length,runId:pair.runId});await yieldLoop();
 }
 if(shouldCancel())throw cancelled();
 return{schemaVersion:'reality-ensemble.v1',manifestId:manifest.id,modelVersion:manifest.modelVersion,engine:manifest.engine,status:'completed',clock:realityClock(manifest.engine,time),runs,completedFutures:runs.length,availableCompletedFutures:completed.length,omittedCompletedFutures:completed.length-runs.length,selection:'Completed catalog rows in ascending actual runIndex; no duplication or replacement',work,records:[...geometry.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>({...row,baseline:finishArm(row.baseline,runs.length,city),treatment:finishArm(row.treatment,runs.length,city)})),coverage:{geometryRecords:geometry.size,unlocatedBuildingObservations:unlocatedBuildings,unlocatedUnitObservations:unlocatedUnits,unlocatedPeopleObservations:unlocatedPeople,source:'Actual stable model IDs / supplied source footprint IDs. No nearest-building or district allocation.'},interpretation:'Presence frequencies are frequencies in the selected synthetic scenarios, not empirical probabilities, confidence or calibrated forecasts.',limitations:[...manifest.limitations,'Only actual stored completed run indices are replayed. One pair is retained at a time; full replay states are not returned.','City rent is per observed unit; no unavailable rents or population housing units are invented.','The calendar anchor is a declared UI assumption; the authoritative simulation clock remains month/minute.']};
}
