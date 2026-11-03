import {test,expect} from 'bun:test';
import {createPopulationRuntime} from '../world/population/runtime.js';
import {readPopulationCheckpoint} from '../world/population/checkpoint.js';

const create=(extra={})=>createPopulationRuntime({config:{population:12,householdSize:4,seed:42,employmentRate:0},worldContext:{buildings:[{id:'workflow-home',kind:'home',center:[0,0]}]},initialMinute:360,stepMinutes:1,clockMode:'minutes-per-second',workerCount:1,...extra});
async function fixture(runtime){await runtime.ready;const person=runtime.getSnapshot().visibleAgents.find(p=>p.ageYears>=18);return{personId:person.id,householdId:person.householdId,household:await runtime.inspectHousehold(person.householdId)};}
const state=async runtime=>readPopulationCheckpoint(await runtime.exportCheckpoint()).model;

test('queued cook/eat/shower/sleep survives a mid-cook save with identical cash, food, needs and completions',async()=>{
 const live=create(),restored=create();try{
  const f=await fixture(live);await restored.ready;const initial=await state(live),ids=[];
  for(const type of ['cook','eat','shower','sleep']){const result=await live.queueHouseholdTask({householdId:f.householdId,personId:f.personId,type,durationMinutes:15});ids.push(result.task.id);}
  let model=await state(live);expect(model.minute).toBe(360);expect(model.households.savings).toEqual(initial.households.savings);expect(model.houseTasks.byPerson).toBeDefined();
  for(let n=0;n<7;n++)await live.step();model=await state(live);const i=Number(f.personId.split('-p').at(-1)),h=model.people.household[i];expect(model.houses.homes[h].actions[0].type).toBe('cook');expect(model.houses.homes[h].transactions).toHaveLength(1);
  await restored.restoreCheckpoint(await live.exportCheckpoint());
  for(let n=0;n<60;n++)await Promise.all([live.step(),restored.step()]);
  const a=await state(live),b=await state(restored);expect(b).toEqual(a);
  const completed=a.houseTasks.history.filter(t=>ids.includes(t.id));expect(completed.map(t=>t.request.type)).toEqual(['cook','eat','shower','sleep']);expect(completed.every(t=>t.status==='completed')).toBe(true);expect(new Set(completed.map(t=>t.actionId)).size).toBe(4);
  const home=a.houses.homes[h];expect(home.transactions.filter(t=>t.type==='cook')).toHaveLength(1);expect(home.totals.mealsConsumed).toBe(1);expect(a.people.hygiene[i]).toBeGreaterThan(initial.people.hygiene[i]);expect(a.people.comfort[i]).toBeGreaterThan(initial.people.comfort[i]);expect(a.people.household).toEqual(initial.people.household);expect(live.getSnapshot().runtime.paused).toBe(true);
 }finally{live.destroy();restored.destroy();}
},30000);

test('blocked tasks can be reordered/cancelled without spending and a running task cannot be silently moved',async()=>{
 const runtime=create();try{
  const f=await fixture(runtime),input={householdId:f.householdId,personId:f.personId},before=await state(runtime);
  const eat=await runtime.queueHouseholdTask({...input,type:'eat',durationMinutes:15}),read=await runtime.queueHouseholdTask({...input,type:'read',durationMinutes:15}),shower=await runtime.queueHouseholdTask({...input,type:'shower',durationMinutes:15});
  await runtime.step();let m=await state(runtime),i=Number(f.personId.split('-p').at(-1));expect(m.houseTasks.byPerson[i][0]).toMatchObject({id:eat.task.id,status:'blocked'});expect(m.houseTasks.byPerson[i][0].reason).toBeTruthy();expect(m.households.savings).toEqual(before.households.savings);
  await runtime.reorderHouseholdTasks({...input,taskIds:[read.task.id,shower.task.id,eat.task.id]});await runtime.cancelHouseholdTask({...input,taskId:eat.task.id});await runtime.step();
  const committed=await runtime.exportCheckpoint();let rejected=false;try{await runtime.reorderHouseholdTasks({...input,taskIds:[shower.task.id,read.task.id]});}catch{rejected=true;}expect(rejected).toBe(true);expect(await runtime.exportCheckpoint()).toEqual(committed);
  await runtime.cancelHouseholdTask({...input,taskId:read.task.id});m=await state(runtime);expect(m.houseTasks.history.find(t=>t.id===read.task.id).status).toBe('cancelled');await runtime.step();m=await state(runtime);expect(m.houseTasks.byPerson[i][0]).toMatchObject({id:shower.task.id,status:'active'});expect(m.households.savings).toEqual(before.households.savings);
 }finally{runtime.destroy();}
},30000);


test('doors, windows, room paint and sale undo/redo persist through the same whole-city checkpoint',async()=>{
 const bootstrap=create();let a,b;try{
  const f=await fixture(bootstrap),site={householdId:f.householdId,buildingId:'workflow-home',status:'mapped',footprint:{outer:[[-13,-11],[13,-11],[13,11],[-13,11]],holes:[]}};
  a=create({houseBuildSites:{[f.householdId]:site}});b=create();await Promise.all([a.ready,b.ready]);const initial=await a.inspectHousehold(f.householdId),input={householdId:f.householdId};
  const room=await a.buildHouse({...input,type:'room',polygon:[{x:-12,z:-10},{x:-8,z:-10},{x:-8,z:-6},{x:-12,z:-6}],commandId:'workflow-room'});
  expect(room.cost).toBe(192);const wallId='site-0-wall-0';await a.buildHouse({...input,type:'door',wallId,offset:.2,commandId:'workflow-door'});await a.buildHouse({...input,type:'window',wallId,offset:.7,commandId:'workflow-window'});await a.buildHouse({...input,type:'paint',wallId,color:'#cfe2b7',commandId:'workflow-paint'});
  const books=initial.house.objects.find(o=>o.type==='books');await a.buildHouse({...input,type:'sell',objectId:books.id,commandId:'workflow-sell'});let home=await a.inspectHousehold(f.householdId);expect(home.house.build.rooms).toHaveLength(1);expect(home.house.build.openings).toHaveLength(2);expect(home.house.build.paints[wallId]).toBe('#cfe2b7');expect(home.house.objects.some(o=>o.id===books.id)).toBe(false);expect(home.savings).toBe(initial.savings-192-90-70-25+45);
  await a.buildHouse({...input,type:'undo'});await b.restoreCheckpoint(await a.exportCheckpoint());await Promise.all([a.buildHouse({...input,type:'redo'}),b.buildHouse({...input,type:'redo'})]);expect(await state(b)).toEqual(await state(a));home=await a.inspectHousehold(f.householdId);const cash=home.savings;
  await a.buildHouse({...input,type:'sell',objectId:books.id,commandId:'workflow-sell'});expect((await a.inspectHousehold(f.householdId)).savings).toBe(cash);
  const before=await a.exportCheckpoint();let rejected=false;try{await a.buildHouse({...input,type:'room',polygon:[{x:50,z:50},{x:54,z:50},{x:54,z:54},{x:50,z:54}],commandId:'outside'});}catch{rejected=true;}expect(rejected).toBe(true);expect(await a.exportCheckpoint()).toEqual(before);expect(a.getSnapshot().minute).toBe(360);
 }finally{bootstrap.destroy();a?.destroy();b?.destroy();}
},30000);

test('a household autonomously repairs a broken shower and recovers neglected hygiene and comfort over a real day',async()=>{
 const {createCustomHouseholdSave}=await import('../world/house/creator-model.js'),{createPopulationCheckpoint}=await import('../world/population/checkpoint.js');
 const profile=name=>({name,ageYears:30,shirtColor:'#689c84',skinColor:'#c99978',hairColor:'#49392f',voice:'warm',traits:['neat','creative','social'],interests:['hobbies']}),created=await createCustomHouseholdSave({name:'Repair routine',startingMoney:14250,relationship:'roommates',members:[profile('Alex'),profile('Jo')]},{seed:715}),runtime=create();
 try{await runtime.ready;await runtime.restoreCheckpoint(created.save.checkpoint);await runtime.configureHouseLife({householdId:created.householdId,parameters:{breakagePerUseHour:0,firePerCookMinute:0,eventChancePerDay:0}});const saved=readPopulationCheckpoint(await runtime.exportCheckpoint()),m=saved.model;for(let i=0;i<2;i++){m.people.hygiene[i]=5;m.people.comfort[i]=5;m.people.hunger[i]=85;m.people.fun[i]=85;m.people.social[i]=85;m.people.energy[i]=85;}m.houses.homes[0].life.conditions['baseline-shower']={wear:.8,broken:true,useMinutes:100};await runtime.restoreCheckpoint(createPopulationCheckpoint(saved));await runtime.observeHousehold({householdId:created.householdId,minutes:1440});const house=await runtime.inspectHousehold(created.householdId);expect(house.house.life.conditions['baseline-shower'].broken).toBe(false);expect(house.house.transactions.filter(t=>t.type==='callRepair')).toHaveLength(1);for(const member of house.memberDetails){expect(member.needs.hygiene).toBeGreaterThan(5);expect(member.needs.comfort).toBeGreaterThan(5);}expect(house.members).toHaveLength(2);expect(runtime.getSnapshot().minute).toBe(1800);
 }finally{runtime.destroy();}
},30000);
