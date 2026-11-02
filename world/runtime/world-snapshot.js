import {snapshotPopulation} from '../population/model.js';
import {eventEffects} from '../population/behavior.js';
import {WORLD_VERSION,WORLD_RUNTIME_VERSION,cloneWorld,detachedWorld} from './world-state.js';
/** View only: plain detached rows. Never exposes population hot typed arrays. */
export function createWorldSnapshot({model,clock,policy,assumptions,geography,ownership,history,subsystems,cultureProjection,provenance},{visibleLimit=500,selectedPersonId,view}={}){
 if(!Number.isInteger(visibleLimit)||visibleLimit<0||visibleLimit>2000)throw new Error('visibleLimit must be an integer 0–2000');
 const population=snapshotPopulation(model,{visibleLimit,selectedPersonId,view,trackSelected:false}),historyView=history.snapshot();
 const environment={status:'partial',source:'population-model scheduled district effects',districtEffects:eventEffects(model,model.minute).map((effects,index)=>({districtId:model.districts[index].id,...effects})),scheduledEvents:cloneWorld(model.config.events),hydrologyImplemented:false,limitations:['No migrated flood hydraulics, physical damage, recovery, or civic budgets.']};
 const infrastructure={status:'not-migrated',source:'geography supplies locations only; capacities are population assumptions unless separately supplied',districts:population.districts.map(row=>({id:row.id,housingUnits:row.housingUnits,jobs:row.jobs,transit:row.transit})),constructionImplemented:false};
 const observations={};
 for(const system of subsystems){const value=system.observe?system.observe(system.state):cloneWorld(system.state);observations[system.id]={version:system.version,owns:[...system.owns],assumptions:cloneWorld(system.assumptions??{}),observation:cloneWorld(value)};}
 const weather=observations.weather?.observation??{enabled:false,status:'not-registered'};environment.weather=weather;
 return detachedWorld({version:WORLD_VERSION,schemaVersion:'world-snapshot.v2',runtimeVersion:WORLD_RUNTIME_VERSION,clock:clock.snapshot(),geography,population,economy:{...population.economy,schemaVersion:model.economy.schemaVersion,closures:model.economy.closures,openings:model.economy.openings,jobCapacity:Array.from(model.economy.jobCapacity),businesses:population.businesses,authority:'population-model.economy',advance:'already included in stepPopulation; no second economy step'},environment,infrastructure,policy,events:historyView.events,eventRetention:historyView.retention,sourceEventCounts:model.eventCounts,metrics:population.metrics,weather,culture:observations.culture?{...observations.culture.observation,populationProjection:cloneWorld(cultureProjection)}:{enabled:false,status:'not-registered'},ownership,assumptions,subsystems:observations,provenance});
}
