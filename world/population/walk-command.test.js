import {test,expect} from 'bun:test';
import {createPopulationModel,stepPopulation,serializePopulation,restorePopulation,refreshPopulationMetrics} from './model.js';
import {applyWalkCommand} from './walk-command.js';
import {createPopulationRuntime} from './runtime.js';
import {readPopulationCheckpoint} from './checkpoint.js';

test('walk command admits existing travel, never teleports, and records elapsed needs/history and arrival',()=>{
 const m=createPopulationModel({population:20},{},{initialMinute:360,initialTick:360}),p=m.people,i=Array.from(p.age).findIndex(a=>a===1),start={x:p.x[i],z:p.z[i],energy:p.energy[i]},savings=m.households.savings.slice();
 const command=applyWalkCommand(m,i,{x:start.x+400,z:start.z});expect(m.minute).toBe(360);expect(p.x[i]).toBe(start.x);expect(p.energy[i]).toBe(start.energy);expect(m.households.savings).toEqual(savings);expect(command.plannedMinutes).toBeCloseTo(10);stepPopulation(m,{minutes:5});expect(p.x[i]).toBeCloseTo(start.x+200);expect(p.energy[i]).toBeLessThan(start.energy);expect(m.activityHistory.totals.activityMinutes.TRANSIT).toBeGreaterThanOrEqual(5);const restored=restorePopulation(serializePopulation(m));stepPopulation(m,{minutes:5});stepPopulation(restored,{minutes:5});expect(serializePopulation(restored)).toEqual(serializePopulation(m));expect(p.x[i]).toBeCloseTo(start.x+400);expect(p.remaining[i]).toBe(0);expect(m.eventCounts.PLAYER_WALK_ARRIVED).toBe(1);expect(m.totals.completedTrips).toBeGreaterThan(0);
});

test('unknown IDs, excessive distance, invalid destinations, traveling residents and minor permissions reject atomically',()=>{
 const m=createPopulationModel({population:80,householdSize:4}),i=Array.from(m.people.age).findIndex(a=>a===1),p=m.people;for(const destination of [{x:Infinity,z:0},{x:p.x[i]+4000,z:p.z[i]},{locationId:'missing'},{x:p.x[i]+10,z:p.z[i],extra:1}]){const before=serializePopulation(m);expect(()=>applyWalkCommand(m,i,destination)).toThrow();expect(serializePopulation(m)).toEqual(before);}const child=Array.from(p.ageYears).findIndex((age,i)=>p.age[i]===0&&age<m.config.childIndependentWalkAge);expect(child).toBeGreaterThanOrEqual(0);expect(()=>applyWalkCommand(m,child,{x:p.x[child]+10,z:p.z[child]})).toThrow('GUARDIAN');applyWalkCommand(m,i,{x:p.x[i]+400,z:p.z[i]});expect(()=>applyWalkCommand(m,i,{x:p.x[i]+500,z:p.z[i]})).toThrow('already traveling');
});

test('paused worker command keeps clock fixed, persists command and in-progress route, and restores exact continuation',async()=>{
 const a=createPopulationRuntime({config:{population:20},initialMinute:360,stepMinutes:1}),b=createPopulationRuntime({config:{population:10}});try{await Promise.all([a.ready,b.ready]);const p=a.getSnapshot().visibleAgents.find(p=>p.ageBand==='adult'),command=await a.walkPerson(p.id,{x:p.x+400,z:p.z});expect(command.accepted).toBe(true);expect(a.getSnapshot().minute).toBe(360);expect(a.getSnapshot().runtime.paused).toBe(true);expect(a.getSnapshot().visibleAgents.find(row=>row.id===p.id).x).toBe(p.x);await a.step();const checkpoint=JSON.parse(JSON.stringify(await a.exportCheckpoint()));expect(readPopulationCheckpoint(checkpoint).runtime.movementTimeline).toHaveLength(1);await b.restoreCheckpoint(checkpoint);for(let n=0;n<12;n++){await a.step();await b.step();}expect(readPopulationCheckpoint(await b.exportCheckpoint())).toEqual(readPopulationCheckpoint(await a.exportCheckpoint()));expect(a.getSnapshot().eventCounts.PLAYER_WALK_ARRIVED).toBe(1);}finally{a.destroy();b.destroy();}
});
