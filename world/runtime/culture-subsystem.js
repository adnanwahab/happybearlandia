import {cloneWorld} from './world-state.js';
/** Aggregate only attributes that the population engine actually has. These
 * are synthetic age/household/location counts, never inferred ethnic beliefs. */
export function populationCultureContext(model,context={}){
 const ages={child:0,adult:0,senior:0};for(const band of model.people.age)ages[['child','adult','senior'][band]]++;
 return{population:model.people.age.length,representedPopulation:model.people.age.length*model.weight,households:model.households.size.length,ageBands:ages,districts:model.districts.map(district=>({id:district.id,population:district.population,households:district.households,services:district.services,x:district.x,z:district.z})),institutions:(context.buildings??[]).filter(building=>['worship','religious','community','library','school','culture','cultural','theatre','theater','museum','park'].includes(building.kind)||building.institutionType).map(building=>({id:String(building.id),kind:building.institutionType??building.kind,center:cloneWorld(building.center)})),provenance:{synthetic:true,source:'existing population age/household/district arrays and supplied building metadata',ethnicity:'not modeled',religion:'not inferred',limitations:['Age bands are broad model categories, not measured demographics. Institution categories use provided geometry metadata only.']}};
}
/** Culture has its own cultural state; it receives aggregate composition, not
 * resident/economy hot arrays. The outer runtime supplies committed minutes. */
export function createCultureSubsystem({createSimulation,model,context,initialMinute,parameters={}}){
 if(typeof createSimulation!=='function')throw new Error('Culture simulation factory is required');
 const composition=populationCultureContext(model,context);
 const initialize=()=>createSimulation({seed:model.config.seed,initialMinute,context:{...cloneWorld(context),districts:cloneWorld(composition.districts),populationComposition:composition},population:{age:model.people.age.slice()},parameters:cloneWorld(parameters)});
 return{id:'culture',version:'culture-runtime-adapter.v1',owns:['culture'],assumptions:{composition:composition.provenance,economy:'no separate business/job/budget state or economy advancement',effects:'only explicitly mapped existing population scheduled-event mechanisms'},initialize,step(simulation,stepContext){const before=simulation.snapshot().activeEvents??[];simulation.stepTo(stepContext.clock.minute);const after=simulation.snapshot().activeEvents??[];for(const event of after)if(!before.some(row=>row.id===event.id))stepContext.emit({type:'CULTURE_EVENT_STARTED',cultureEventId:event.id,eventType:event.type,districtId:event.districtId??null,sourceMinute:event.startMinute,reasonCodes:['COMMITTED_CULTURE_PHASE']});for(const event of before)if(!after.some(row=>row.id===event.id))stepContext.emit({type:'CULTURE_EVENT_ENDED',cultureEventId:event.id,eventType:event.type,districtId:event.districtId??null,sourceMinute:event.endMinute,reasonCodes:['COMMITTED_CULTURE_PHASE']});},observe:simulation=>simulation.snapshot(),serialize:simulation=>simulation.serialize(),restore(saved){const simulation=initialize();simulation.restore(saved);return simulation;}};
}
/** Project only explicit multiplier fields with real district scopes. Narrative
 * mood/attendance/style fields never become numeric outcome adjustments. */
export function culturePopulationInputs(snapshot){
 const rows=snapshot.populationEvents??[...(snapshot.activeEvents??[]),...(snapshot.upcomingEvents??[])];
 if(!Array.isArray(rows)||rows.length>128)throw new Error('Culture population inputs exceed 128 bounded source events');
 const events=[],unsupported=[],seen=new Set();
 for(const row of rows){if(seen.has(row.id))continue;seen.add(row.id);
  const effects=row.multipliers??row.effects??{},multipliers={};
  for(const[key,value]of Object.entries(effects))if(['roads','transit','services','demand'].includes(key)&&Number.isFinite(value)&&value>=0)multipliers[key]=value;else unsupported.push({eventId:row.id,mechanism:key,reason:'No explicit nonnegative population mechanism multiplier was supplied; narrative/outcome adjustments are not applied.'});
  if(!Object.keys(multipliers).length)continue;
  if(!row.districtId&&!row.districtIds){unsupported.push({eventId:row.id,reason:'No explicit actual district scope was supplied; no geographic scope was inferred.'});continue;}
  events.push({id:row.id,startMinute:row.startMinute,endMinute:row.endMinute,durationMinutes:row.durationMinutes,districtId:row.districtId,districtIds:row.districtIds,multipliers});
 }
 return{events,unsupported};
}
