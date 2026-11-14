import {test,expect} from 'bun:test';
import {createObjectDiscovery} from '../world/house/discovery.js';
const object={id:'table-1',type:'diningTable',roomId:'kitchen'},person={id:'resident-1',ageYears:30,atHome:true};
const context={object,person,home:{objects:[object],actionCatalog:{eat:{durationMinutes:20,minAge:3}}}};
test('only affirmative authoritative availability shows discovery; inspection preserves inputs',async()=>{
 const original=JSON.stringify(context),shown=[],requests=[];let available=false;
 const discovery=createObjectDiscovery({check:async(entry,request)=>{requests.push(request);return{available};},onChange:id=>shown.push(id)});
 await discovery.inspect(context);expect(shown).toEqual([null]);available=true;await discovery.inspect(context);expect(shown.at(-1)).toBe(object.id);
 expect(requests[0]).toEqual({execution:'now',requireAuthority:true,personId:person.id,objectId:object.id,roomId:object.roomId});expect(JSON.stringify(context)).toBe(original);
});
test('away, decorative, missing capability and failed authority stay dark',async()=>{
 for(const input of [{...context,person:{...person,atHome:false}},{...context,home:{...context.home,objects:[{...object,decorative:true}]}},{...context,home:{...context.home,actionCatalog:{}}},context]){
  const shown=[],discovery=createObjectDiscovery({check:async()=>{throw Error('offline');},onChange:id=>shown.push(id)});await discovery.inspect(input);expect(shown).toEqual([null]);
 }
});
test('selection changes and disposal invalidate delayed replies',async()=>{
 let resolve;const shown=[],discovery=createObjectDiscovery({check:()=>new Promise(done=>resolve=done),onChange:id=>shown.push(id)});
 const pending=discovery.inspect(context);discovery.clear();resolve({available:true});await pending;expect(shown).toEqual([null,null]);
 const old=discovery.inspect(context);await discovery.inspect({...context,person:{...person,atHome:false}});resolve({available:true});await old;expect(shown.at(-1)).toBeNull();
});
test('real seeded authority accepts installed rest, rejects unfed eating and leaves checkpoint unchanged',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');
 const runtime=createPopulationRuntime({config:{population:8,householdSize:4,seed:42},initialMinute:360,stepMinutes:1});
 try{
  await runtime.ready;const household=await runtime.inspectHousehold(runtime.getSnapshot().households[0].id),person={...household.memberDetails[0],...household.house.members[0]},home=household.house,before=await runtime.exportCheckpoint(),shown=[];
  const discovery=createObjectDiscovery({check:(entry,request)=>runtime.householdActionAvailability({householdId:household.id,...entry.command,personId:request.personId,interrupt:true}),onChange:id=>shown.push(id)});
  const couch=home.objects.find(row=>row.type==='couch');await discovery.inspect({object:couch,home,person});expect(shown.at(-1)).toBe(couch.id);
  const table=home.objects.find(row=>row.type==='diningTable'),eatOnly={...home,actionCatalog:{eat:home.actionCatalog.eat}};await discovery.inspect({object:table,home:eatOnly,person});expect(shown.at(-1)).toBeNull();
  expect(await runtime.exportCheckpoint()).toEqual(before);
 }finally{runtime.destroy();}
});
