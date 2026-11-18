/** Read-only Life Story source for the legacy World authority (world/sim.js).
 *
 * Reads only published interfaces and plain state: activity history, the activity
 * snapshot row (with decision trace), building names, household money, the
 * already-created social model and the existing person-command options. It
 * never advances time, draws random numbers or creates social state. */
import {ACTIONS} from '../sim.js';
import {legacySocial} from '../relationships/model.js';

export const LIFE_STORY_SOURCE_VERSION='life-story-source.v1';
const buildingIndexes=new WeakMap();
const MEMORIES_PER_RELATIONSHIP=3;

function buildingIndex(world){
 let index=buildingIndexes.get(world);
 if(!index||index.size!==world.buildings.length){index=new Map(world.buildings.map(b=>[String(b.id),b]));buildingIndexes.set(world,index);}
 return index;
}

function referencedBuildingIds(person,row,history){
 const ids=new Set();
 for(const index of [person.home,person.job,person.school])if(Number.isInteger(index)&&index>=0)ids.add(index);
 const add=value=>{if(value!==null&&value!==undefined&&value!=='')ids.add(String(value));};
 for(const event of [...(history.actorTimeline?.events??[]),...(history.recentEvents??[])]){add(event?.buildingId);add(event?.destinationId);}
 for(const decision of row?.decisionTrace??[])for(const option of decision?.alternatives??[])add(option?.buildingId);
 return ids;
}

function socialSummary(world,id){
 // Only inspect a social model the host already created; creating it here would
 // add state to the authoritative world just because someone opened a view.
 if(!world.social)return null;
 const inspected=legacySocial(world).inspect(id);
 return{
  relationships:(inspected.relationships??[]).map(r=>({id:String(r.id),name:r.name,label:r.label,friendship:r.friendship,trust:r.trust,tension:r.tension,romance:r.romance,
   memories:(r.memories??[]).slice(-MEMORIES_PER_RELATIONSHIP).map(m=>({minute:m.minute,event:m.event,text:m.text}))})),
  goals:(inspected.goals??[]).map(g=>({id:g.id,title:g.title,help:g.help,completed:Boolean(g.completed)})),
  promises:(inspected.promises??[]).map(p=>({id:p.id,a:p.a,b:p.b,aName:p.aName,bName:p.bName,status:p.status,dueMinute:p.dueMinute})),
 };
}

export function readLegacyLifeStorySource({world,id}){
 if(!world?.people||!world?.buildings)throw new Error('The classic neighborhood is not ready.');
 const actorId=String(id),person=world.people.find(p=>String(p.id)===actorId);
 if(!person)throw new Error('That resident is not in the current neighborhood.');
 world.trackActivityPerson(actorId);
 const history=world.getActivityHistory({actorId,includeBuckets:false});
 const row=world.getActivitySnapshot().people.find(p=>String(p.id)===actorId)??null;
 const index=buildingIndex(world),places={};
 for(const ref of referencedBuildingIds(person,row,history)){
  const building=typeof ref==='number'?world.buildings[ref]:index.get(ref);
  if(building)places[String(building.id)]={name:building.name??null,kind:building.kind??null};
 }
 const household=world.householdById?.get(String(person.householdId))??null;
 let social=null,socialError=null;
 try{social=socialSummary(world,actorId);}catch(error){socialError=error.message;}
 let options=[],optionsError=null;
 try{options=(world.getPersonCommandOptions?.(actorId)??[]).slice(0,12).map(option=>({...option,cost:Number.isFinite(ACTIONS[option.actionId]?.cost)?ACTIONS[option.actionId].cost:null}));}catch(error){optionsError=error.message;}
 return{
  schemaVersion:LIFE_STORY_SOURCE_VERSION,mode:'legacy',minute:world.t,identity:world.getActivityIdentity(),
  person:{id:actorId,name:person.name,age:person.age,trait:person.trait,householdId:person.householdId,
   needs:{...person.needs},doing:row?.doing??person.doing??null,activity:row?.activity??null,
   home:Number.isInteger(person.home)?String(world.buildings[person.home]?.id??''):null,
   decisionTrace:structuredClone(row?.decisionTrace??[])},
  household:household?{id:household.id,cash:household.cash,lastDailyCost:household.lastDailyCost,lastShortfall:household.lastShortfall,stressedDays:household.stressedDays}:null,
  history,places,social,socialError,options,optionsError,actionCatalog:actionCatalog(),
 };
}

let catalog=null;
/** Labels, need rates (points per modeled minute) and prices from world/sim.js ACTIONS. */
function actionCatalog(){
 catalog ??= Object.freeze(Object.fromEntries(Object.entries(ACTIONS).map(([id,action])=>[id,Object.freeze({label:action.label??id,rate:Object.freeze({...(action.rate??{})}),cost:Number.isFinite(action.cost)?action.cost:null})])));
 return catalog;
}

/** Sends one of the offered nudges through the existing authoritative command. */
export function commandLegacyResident({world,id,option}){
 if(!world?.commandPerson)throw new Error('Resident commands are not ready.');
 if(option?.type!=='activity'||typeof option.actionId!=='string'||option.buildingId===undefined)throw new Error('Choose one of the offered activities.');
 return world.commandPerson(String(id),{type:'activity',actionId:option.actionId,buildingId:option.buildingId});
}
