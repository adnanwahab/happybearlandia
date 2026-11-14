import {test,expect} from 'bun:test';
import {householdMilestones,loadHouseholdMilestones} from '../world/house/milestones.js';
import {createPopulationRuntime} from '../world/population/runtime.js';
import {readPopulationCheckpoint} from '../world/population/checkpoint.js';
import {recordEvent} from '../world/population/contracts.js';

async function fixture(){
 const runtime=createPopulationRuntime({config:{population:12,seed:559},stepMinutes:1});await runtime.ready;
 await runtime.step();const checkpoint=await runtime.exportCheckpoint();runtime.destroy();
 const state=readPopulationCheckpoint(checkpoint),model=state.model,personId=model.prefix+'-p0',householdId=model.prefix+'-h'+model.people.household[0];
 return {model,personId,householdId,id:'history01',tick:state.runtime.tick,stepMinutes:1};
}
test('recorded milestones preserve source, deterministic order, exact seek and immutable inputs',async()=>{
 const c=await fixture();recordEvent(c.model,'JOB_FOUND',{personId:c.personId});recordEvent(c.model,'HOUSEHOLD_MOVED',{householdId:c.householdId});
 const key=JSON.stringify([c.personId,c.model.prefix+'-p1']);c.model.social={ties:{[key]:{a:c.personId,b:c.model.prefix+'-p1',commitmentMilestones:[{actionId:'actual-wedding',event:'wedding',minute:c.model.minute,personIds:[c.personId,c.model.prefix+'-p1']}]}}};
 const before=structuredClone(c);const rows=householdMilestones([c],c.householdId);
 expect(rows.map(r=>r.category).sort()).toEqual(['job','moving-in','relationship']);
 expect(rows.every(r=>r.seekId===c.id&&r.tick===c.tick)).toBe(true);expect(rows[0].sourcePath).toBeTruthy();
 expect(householdMilestones([c,c],c.householdId)).toEqual(rows);expect(c).toEqual(before);
 c.model.events[0].tick=0;c.model.events[0].minute=0;
 expect(householdMilestones([c],c.householdId).find(r=>r.category==='job').seekId).toBeNull();
});
test('starting state, missing records, wrong households, future and inconsistent clocks cannot invent milestones',async()=>{
 const c=await fixture();expect(householdMilestones([c],c.householdId)).toEqual([]);
 for(const detail of [{householdId:'other'},{tick:c.tick+1},{minute:c.model.minute+1},{tick:-1},{schemaVersion:'event.v1'},{synthetic:false},{modelVersion:'unknown'}]){
  c.model.events=[];recordEvent(c.model,'JOB_FOUND',{personId:c.personId,...detail});expect(householdMilestones([c],c.householdId)).toEqual([]);
 }
 c.model.events=[];recordEvent(c.model,'UNRECORDED_GUESS',{personId:c.personId});expect(householdMilestones([c],c.householdId)).toEqual([]);
});
test('loader decodes real immutable saves and reports missing parents without backfill',async()=>{
 const runtime=createPopulationRuntime({config:{population:12,seed:559},stepMinutes:1});await runtime.ready;
 const checkpoint=await runtime.exportCheckpoint();runtime.destroy();const {model}=readPopulationCheckpoint(checkpoint),householdId=model.prefix+'-h0';
 const record={schemaVersion:'world-experiment-record.v1',id:'history01',parentId:'missing01',save:{schemaVersion:'world-experiment-save.v1',mode:'living',view:{},checkpoint}};
 const before=JSON.stringify(record),fetcher=async path=>path.endsWith('history01')?Response.json(record):new Response('',{status:404});
 const result=await loadHouseholdMilestones('history01',householdId,{fetcher});expect(result.rows).toEqual([]);expect(result.notice).toContain('Earlier history unavailable');expect(JSON.stringify(record)).toBe(before);
 await expect(loadHouseholdMilestones('missing01',householdId,{fetcher})).rejects.toThrow('not found');
});
test('loader rejects incompatible branches and stops cycles rather than matching equal local IDs',async()=>{
 async function record(seed,id,parentId){const runtime=createPopulationRuntime({config:{population:12,seed},stepMinutes:1});await runtime.ready;const checkpoint=await runtime.exportCheckpoint();runtime.destroy();return{schemaVersion:'world-experiment-record.v1',id,parentId,save:{schemaVersion:'world-experiment-save.v1',mode:'living',view:{},checkpoint}};}
 const child=await record(559,'history01','history02'),parent=await record(560,'history02',null);
 const fetcher=async path=>Response.json(path.endsWith('history01')?child:parent);
 const result=await loadHouseholdMilestones('history01','irrelevant-h0',{fetcher});expect(result.rows).toEqual([]);expect(result.notice).toContain('incompatible');
 child.parentId='history01';const cycle=await loadHouseholdMilestones('history01','irrelevant-h0',{fetcher});expect(cycle.notice).toContain('Invalid parent link');
});
