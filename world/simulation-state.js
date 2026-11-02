// Explicit longitudinal compatibility state. No meshes, functions, random
// generator, global activity recorder, or canonical population state is copied.
import { createWeatherSimulation } from './weather/weather-simulation.js';
const PERSON_FIELDS=['home','job','school','needs','x','z','mode','action','target','until','doing','workedToday','today','yesterday','walkHistory','walkMinutesAvg3d','travelHistory','travelMinutesAvg3d','commuteMinutesAvg3d','path','pathI','tx','tz','travelMode','transitWaitMinutesRemaining','tripStartedMinute','tripDistanceMeters','tripTravelMinutes','tripWalkMinutes','tripTransitMinutes','tripWaitMinutes','tripRideMetersPerMinute','lastTrip','displaced','originalHome'];
const BUILDING_FIELDS=['stock','maxStock','fridge','cash','litter','open','visitors'];
const HOUSEHOLD_FIELDS=['cash','stressedDays','lastDailyCost','lastShortfall','lastCostDay','voucherPeriods'];
const select=(object,fields)=>Object.fromEntries(fields.filter(key=>object?.[key]!==undefined).map(key=>[key,structuredClone(object[key])]));
const id=value=>String(value);
function topology(world){
  const people=world.people.map(p=>({id:id(p.id),householdId:id(p.householdId)}));
  const buildings=world.buildings.map(b=>({id:id(b.id),index:b.index,kind:b.kind,center:b.center}));
  for(const rows of [people,buildings])if(rows.some(row=>row.id==='undefined')||new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Simulation state requires unique stable IDs');
  return {seedKey:world.seedKey,origin:world.origin,people,buildings,roads:(world.roads||[]).map(road=>road.pts)};
}
function validateRows(saved,current,label){
  if(!Array.isArray(saved)||saved.length!==current.length||new Set(saved.map(row=>id(row.id))).size!==saved.length||saved.some(row=>!current.some(other=>id(other.id)===id(row.id))))throw new Error(`Simulation state ${label} IDs mismatch`);
}
export function captureSimulationState(world){
  return {schemaVersion:'legacy-simulation-state.v1',minute:world.t,topology:structuredClone(topology(world)),
    households:world.households.map(h=>({id:h.id,members:[...h.members],...select(h,HOUSEHOLD_FIELDS)})),
    people:world.people.map(p=>({id:p.id,...select(p,PERSON_FIELDS)})),
    buildings:world.buildings.map(b=>({id:b.id,state:select(b.state,BUILDING_FIELDS),flaggedDirty:!!b.flaggedDirty})),
    culture:world.culture?.serialize?.()??null,
    weather:world.weather?.serialize?.()??null,
    semantics:'Representative sampled minutes only; policy, RNG and external activity history are not restored.'};
}
export function restoreSimulationState(world,state,{preserveClock=false}={}){
  if(state?.schemaVersion!=='legacy-simulation-state.v1'||!Number.isSafeInteger(state.minute)||state.minute<0)throw new Error('Unsupported or invalid simulation state');
  if(JSON.stringify(state.topology)!==JSON.stringify(topology(world)))throw new Error('Simulation state topology mismatch');
  validateRows(state.people,world.people,'person');validateRows(state.buildings,world.buildings,'building');validateRows(state.households,world.households,'household');
  for(const h of state.households){const current=world.households.find(row=>id(row.id)===id(h.id));if(JSON.stringify(h.members)!==JSON.stringify(current.members)||['cash','stressedDays','lastDailyCost','lastShortfall','lastCostDay'].some(key=>!Number.isFinite(h[key])||h[key]<0)||!Array.isArray(h.voucherPeriods)||h.voucherPeriods.some(key=>typeof key!=='string'))throw new Error('Invalid household state');}
  for(const p of state.people){
    if(!['idle','moving','doing'].includes(p.mode)||!p.needs||['hunger','energy','fun','social'].some(key=>!Number.isFinite(p.needs[key])||p.needs[key]<0||p.needs[key]>100)||!world.buildings[p.home]||['job','school','target'].some(key=>p[key]!=null&&!world.buildings[p[key]])||['x','z','until'].some(key=>!Number.isFinite(p[key]))||p.path!=null&&(!Array.isArray(p.path)||p.path.some(point=>!Array.isArray(point)||point.length!==2||point.some(value=>!Number.isFinite(value)))))throw new Error('Invalid person state');
  }
  for(const b of state.buildings)if(!b.state||BUILDING_FIELDS.some(key=>b.state[key]!==undefined&&key!=='open'&&!Number.isFinite(b.state[key])))throw new Error('Invalid building state');
  const nextMinute=preserveClock?world.t:state.minute,delta=nextMinute-state.minute;
  const weather=state.weather?structuredClone(state.weather):null;
  if(weather){weather.minute+=delta;weather.initialMinute=Math.max(0,weather.initialMinute+delta);createWeatherSimulation().restore(weather);}
  // Validate/restore culture before mutating the remaining world fields.
  if(state.culture&&world.culture?.restore){const saved=structuredClone(state.culture);saved.minute+=delta;saved.lastPlannedDay+=Math.floor(nextMinute/1440)-Math.floor(state.minute/1440);for(const event of [...saved.pending,...saved.active]){event.startMinute+=delta;event.endMinute+=delta;}for(const event of saved.history){event.minute+=delta;if(event.event){event.event.startMinute+=delta;event.event.endMinute+=delta;}}world.culture.restore(saved);}
  if(weather)world.weather?.restore?.(weather);
  world.t=nextMinute;
  const dayDelta=Math.floor(nextMinute/1440)-Math.floor(state.minute/1440);
  for(const saved of state.households){const h=world.households.find(row=>id(row.id)===id(saved.id));Object.assign(h,select(saved,HOUSEHOLD_FIELDS));if(Number.isFinite(h.lastCostDay))h.lastCostDay+=dayDelta;}
  for(const saved of state.people){const p=world.people.find(row=>id(row.id)===id(saved.id));for(const key of PERSON_FIELDS)delete p[key];Object.assign(p,select(saved,PERSON_FIELDS));if(Number.isFinite(p.until))p.until+=delta;if(Number.isFinite(p.tripStartedMinute))p.tripStartedMinute+=delta;for(const day of [p.today,p.yesterday])if(day){day.day+=dayDelta;day.homeFlooded=false;}p.homeFlooded=false;}
  for(const saved of state.buildings){const b=world.buildings.find(row=>id(row.id)===id(saved.id));Object.assign(b.state,select(saved.state,BUILDING_FIELDS));b.state.flooded=false;b.flaggedDirty=saved.flaggedDirty;}
  world.cultureSnapshot=world.culture?.snapshot?.()??null;
  world.refreshWeatherEffects?.();
  return world;
}
