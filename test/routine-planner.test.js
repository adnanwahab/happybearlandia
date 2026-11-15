import { test, expect } from 'bun:test';
import { createRoutineDraft, runRoutine } from '../world/house/routine-planner.js';
import { createPopulationRuntime } from '../world/population/runtime.js';
import { readPopulationCheckpoint } from '../world/population/checkpoint.js';

test('draft rejects unsupported tasks, collisions, clock/boundary errors atomically and undoes every edit',()=>{
 const draft=createRoutineDraft({members:['p'],stepMinutes:30});
 const a={personId:'p',type:'clean',offset:0};draft.replace([a]);
 for(const b of [{...a,type:'furniture'},{...a,personId:'other'},{...a,offset:15},{...a,offset:10080},{...a,offset:-30}])expect(()=>draft.replace([b])).toThrow();
 expect(()=>draft.replace([a,{...a,offset:0}])).toThrow('Overlapping');
 expect(draft.blocks).toEqual([a]);draft.replace([a,{...a,offset:30}]);draft.replace([]);draft.undo();expect(draft.blocks).toHaveLength(2);draft.undo();expect(draft.blocks).toEqual([a]);draft.undo();expect(draft.blocks).toEqual([]);expect(draft.canUndo).toBe(false);
});

test('real Population runs retain pin, seed, clock, admission costs and deterministic checkpoints',async()=>{
 const runtime=createPopulationRuntime({config:{population:2,householdSize:2,seed:42,employmentRate:0},initialMinute:360,stepMinutes:30});
 await runtime.ready;runtime.pause();
 try{
  const checkpoint=await runtime.exportCheckpoint(),original=JSON.stringify(checkpoint);
  const {model}=readPopulationCheckpoint(checkpoint),householdId=model.prefix+'-h0';
  const members=(await runtime.inspectHousehold(householdId)).members;
  const input={checkpoint,householdId,members,runId:'pinned123',blocks:[{personId:members[0],type:'clean',offset:0},{personId:members[0],type:'cook',offset:1440}]};
  const first=await runRoutine(runtime,input),second=await runRoutine(runtime,input);
  expect(second).toEqual(first);expect(JSON.stringify(checkpoint)).toBe(original);
  expect(first.seed).toBe(42);expect(first.startMinute).toBe(360);expect(runtime.getSnapshot().minute).toBe(10440);
  expect(first.receipts).toHaveLength(2);expect(first.receipts.map(r=>r.accepted)).toEqual([true,true]);expect(first.receipts.map(r=>r.cost)).toEqual([0,12]);for(const receipt of first.receipts)expect(receipt.accepted?receipt.result.actionId:receipt.reason).toBeTruthy();
 }finally{runtime.destroy();}
},30000);

import { mountRoutinePlanner } from '../world/house/routine-planner-ui.js';
function fixture() {
 const doc={defaultView:{addEventListener(){}},createElement(tag){return {tag,ownerDocument:doc,children:[],style:{},handlers:{},value:'',append(...nodes){this.children.push(...nodes);if(tag==='select'&&!this.value)this.value=nodes[0].value;},replaceChildren(...nodes){this.children=nodes;},setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this.handlers[k]=fn;},focus(){doc.focused=this;}};}};
 return doc.createElement('div');
}
const nodes=root=>[root,...root.children.flatMap(nodes)];
test('form/touch fallback rejects overlaps, moves and removes blocks, and undoes all edits without model writes',async()=>{
 const container=fixture();let writes=0;
 const runtime={pause(){},destroy(){},inspectHousehold:async()=>({savings:0}),getSnapshot:()=>({runtime:{stepMinutes:30},modelVersion:'test',config:{seed:42},minute:360}),householdAction(){writes++;}};
 await mountRoutinePlanner(container,{runtime,entry:{householdId:'h',members:['p']},record:{id:'pin',save:{checkpoint:{}}}});
 const find=text=>nodes(container).find(n=>n.textContent===text);
 const form=nodes(container).find(n=>n.tag==='form');
 const submit=()=>form.handlers.submit({preventDefault(){}});
 submit();expect(nodes(container).filter(n=>n.tag==='article')).toHaveLength(1);
 submit();expect(nodes(container).find(n=>n.role==='status').textContent).toContain('Overlapping');
 const selects=nodes(form).filter(n=>n.tag==='select');selects[2].value='1';
 find('Move task to selected day and minute').handlers.click();
 expect(find('Day 2')).toBeTruthy();expect(find('clean · minute 0 · 30 min · p')).toBeTruthy();
 find('Remove task').handlers.click();expect(nodes(container).filter(n=>n.tag==='article')).toHaveLength(0);
 for(let i=0;i<3;i++)find('Undo last edit').handlers.click();
 expect(nodes(container).filter(n=>n.tag==='article')).toHaveLength(0);expect(find('Undo last edit').disabled).toBe(true);expect(writes).toBe(0);
});

test('canonical budget admission rejects cooking without spending or advancing the pin',async()=>{
 const {createCustomHouseholdSave}=await import('../world/house/creator-model.js');
 const {restoreSavedHouse}=await import('../world/house/app.js');
 const fixture=await createCustomHouseholdSave({name:'Budget fixture',startingMoney:0,relationship:'roommates',members:[{name:'Budget Resident',ageYears:35,voice:'warm',skinColor:'#d1a77c',shirtColor:'#658da6',hairColor:'#534d36',traits:['social','neat','curious'],interests:['hobbies']}]},{runtimeFactory:options=>createPopulationRuntime({...options,stepMinutes:30,clockMode:"ticks-per-poll"})});
 const session=await restoreSavedHouse({schemaVersion:'world-experiment-record.v1',id:'budget12',save:fixture.save},fixture.householdId);
 try{
  const request={householdId:fixture.householdId,personId:session.entry.members[0],type:'cook'};
  const before=await session.runtime.exportCheckpoint();
  const availability=await session.runtime.householdActionAvailability(request);
  expect(availability.available).toBe(false);expect(availability.reason).toMatch(/cash|sav|afford|budget/i);
  expect(await session.runtime.exportCheckpoint()).toEqual(before);
  const report=await runRoutine(session.runtime,{checkpoint:before,householdId:fixture.householdId,members:session.entry.members,runId:'budget12',blocks:[{personId:request.personId,type:'cook',offset:0}]});
  expect(report.receipts[0]).toMatchObject({accepted:false,reason:availability.reason});
 }finally{session.runtime.destroy();}
});

test('drag/drop uses the same admission and undo path and visibly rejects unsupported payloads',async()=>{
 const container=fixture();
 await mountRoutinePlanner(container,{runtime:{pause(){},destroy(){},inspectHousehold:async()=>({savings:0}),getSnapshot:()=>({runtime:{stepMinutes:30},modelVersion:'test',config:{seed:42},minute:0})},entry:{householdId:'h',members:['p']},record:{id:'pin',save:{checkpoint:{}}}});
 const grid=()=>nodes(container).find(n=>n['aria-label']==='Weekly schedule');
 const drop=(day,payload)=>grid().children[day].handlers.drop({preventDefault(){},dataTransfer:{getData:()=>JSON.stringify(payload)}});
 drop(0,{type:'clean'});expect(nodes(container).filter(n=>n.tag==='article')).toHaveLength(1);
 drop(0,{type:'furniture'});expect(nodes(container).find(n=>n.role==='status').textContent).toContain('Unsupported');
 drop(1,{index:0});expect(grid().children[1].children.some(n=>n.tag==='article')).toBe(true);
 nodes(container).find(n=>n.textContent==='Undo last edit').handlers.click();
 expect(grid().children[0].children.some(n=>n.tag==='article')).toBe(true);
});
