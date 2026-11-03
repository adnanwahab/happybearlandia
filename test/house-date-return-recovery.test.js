import {test,expect} from 'bun:test';
import {createPopulationModel} from '../world/population/model.js';
import {createPopulationRuntime} from '../world/population/runtime.js';
import {readPopulationCheckpoint,createPopulationCheckpoint} from '../world/population/checkpoint.js';
import {createDatePlace} from '../world/house/date-place.js';
import {isOnDate} from '../world/house/resident-location.js';
import {endResidentDateForHome} from '../world/house/return-home-request.js';

function fixture(){
 const model=createPopulationModel({population:8,householdSize:4,seed:42},
  {origin:{lat:29.7,lng:-95.4},buildings:[{id:'home',kind:'home',center:[0,0]}]},
  {initialMinute:360,initialTick:360});
 const ids=[model.prefix+'-p0',model.prefix+'-p4'];
 for(const index of [0,4]){model.people.ageYears[index]=30;model.people.age[index]=1;model.people.parent1[index]=-1;model.people.parent2[index]=-1;model.people.employed[index]=0;}
 model.social.ties[JSON.stringify(ids)]={a:ids[0],b:ids[1],kind:'Friends',dating:true,friendship:56,romance:35,tension:0,familiarity:60,memories:[],lastMinute:null};
 model.households.savings[0]=10000;
 return{model,ids,owner:model.prefix+'-h0',returningHome:model.prefix+'-h1'};
}

test('return from the other household ends a saved driving date instantly and releases its blocked home queue',async()=>{
 const f=fixture(),runtime=createPopulationRuntime({config:{population:8,householdSize:4},initialMinute:360,stepMinutes:1,clockMode:'minutes-per-second'});
 try{
  await runtime.ready;
  const state=readPopulationCheckpoint(await runtime.exportCheckpoint());state.model=f.model;
  await runtime.restoreCheckpoint(createPopulationCheckpoint(state));
  const place=createDatePlace({id:'osm:node:123',name:'Supplied cafe',kind:'cafe',lat:29.708,lng:-95.4,osmTags:{amenity:'cafe'}});
  const started=await runtime.householdSystemCommand({householdId:f.owner,system:'dates',type:'start',personIds:f.ids,consentingPersonIds:f.ids,place,travelMode:'drive',route:{schemaVersion:'date-route.v1',mode:'drive',durationMinutes:5,distanceMeters:1000,geometry:[{lat:29.7,lng:-95.4},{lat:place.lat,lng:place.lng}],source:'approximate',approximate:true,reason:'Explicit test route'}});
  for(let n=0;n<6;n++)await runtime.step();
  expect((await runtime.inspectHousehold(f.owner)).house.systems.dates.active).toMatchObject({id:started.dateId,travelMode:'drive',phase:'date'});
  const queued=await runtime.queueHouseholdTask({householdId:f.returningHome,personId:f.ids[1],type:'read'});
  await runtime.step();
  expect((await runtime.inspectHousehold(f.returningHome)).house.taskQueues[0].tasks[0]).toMatchObject({id:queued.task.id,status:'blocked'});
  // Exercise a loaded save, including the active date and blocked queue.
  await runtime.restoreCheckpoint(await runtime.exportCheckpoint());
  const home=await runtime.inspectHousehold(f.returningHome),person=await runtime.inspectPerson(f.ids[1]);
  expect(person.date.householdId).toBe(f.owner);
  expect(isOnDate(person,{home:home.house})).toBe(true);
  const before=readPopulationCheckpoint(await runtime.exportCheckpoint()).model;
  const ended=await endResidentDateForHome(runtime,person,{home:home.house});
  expect(ended.accepted).toBe(true);
  // Ending must release the reservation before the ordinary return-home request.
  expect((await runtime.inspectHousehold(f.owner)).house.systems.dates.active).toBeNull();
  await runtime.walkPerson(f.ids[1],{home:true,instant:true});
  const after=readPopulationCheckpoint(await runtime.exportCheckpoint()).model;
  expect(after.minute).toBe(before.minute);
  expect([...after.people.hunger]).toEqual([...before.people.hunger]);
  expect([...after.people.energy]).toEqual([...before.people.energy]);
  expect([...after.households.savings]).toEqual([...before.households.savings]);
  expect(after.dateAssignments[0]).toBeUndefined();expect(after.dateAssignments[4]).toBeUndefined();
  expect(after.houses.homes[0].systems.dates.history).toHaveLength(1);
  expect(after.houses.homes[0].systems.dates.history[0].id).toBe(started.dateId);
  expect(after.houses.homes[0].systems.dates.history[0].activity.noCompletionGranted).toBe(true);
  expect(after.people.household[4]).toBe(1);
  expect(after.people.x[4]).toBe(after.people.homeX[4]);expect(after.people.z[4]).toBe(after.people.homeZ[4]);
  const returned=await runtime.inspectHousehold(f.returningHome);
  expect(isOnDate(returned.memberDetails.find(p=>p.id===f.ids[1]),returned)).toBe(false);
  await runtime.step();
  expect((await runtime.inspectHousehold(f.returningHome)).house.taskQueues[0].tasks[0]).toMatchObject({id:queued.task.id,status:'active'});
 }finally{runtime.destroy();}
},30000);

test('a resident with no active date does not send a date command or change their home view',async()=>{
 const calls=[],person={id:'city-p0',atHome:false},data={home:{householdId:'city-h0',systems:{dates:{active:null}}}},before=structuredClone({person,data});
 expect(await endResidentDateForHome({householdSystemCommand:input=>{calls.push(input);}},person,data)).toBeNull();
 expect(calls).toEqual([]);expect({person,data}).toEqual(before);
});

test('a rejected date completion stops the ordered return sequence before walking home',async()=>{
 const calls=[],person={id:'city-p4',date:{id:'city-h0-date-1',householdId:'city-h0',phase:'date'}},data={home:{householdId:'city-h1',systems:{dates:{active:null}}}};
 const runtime={householdSystemCommand:async input=>{calls.push(input);return{accepted:false,reason:'The date changed; refresh first.'};},walkPerson:async()=>{calls.push('walk');}};
 const returnHome=async()=>{await endResidentDateForHome(runtime,person,data);await runtime.walkPerson(person.id,{home:true,instant:true});};
 await expect(returnHome()).rejects.toThrow('The date changed; refresh first.');
 expect(calls).toEqual([{householdId:'city-h0',system:'dates',type:'end',dateId:'city-h0-date-1',travelMode:'instant'}]);
});
