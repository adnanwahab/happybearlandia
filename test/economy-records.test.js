import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEconomyRecordsHandler} from '../world/economy-records-api.js';
test('economic collection persists, deduplicates retries, paginates and rejects invalid records',async()=>{
 const root=mkdtempSync(join(tmpdir(),'hbl-economy-'));
 try{const handler=createEconomyRecordsHandler({root}),call=(query='',body)=>handler(new Request(`http://localhost/api/economy-records${query}`,body?{method:'POST',body:JSON.stringify(body)}:{}));
 const payload={runId:'population_test_0',tick:1,minute:30,metrics:{employmentRate:.8},people:[{id:'person-1'}],events:[]};
 const saved=await(await call('',payload)).json();expect(saved.id).toBe(1);expect((await(await call('',payload)).json()).id).toBe(1);
 const reopened=createEconomyRecordsHandler({root});const record=await(await reopened(new Request('http://localhost/api/economy-records?id=1'))).json();expect(record.payload).toEqual(payload);
 expect((await(await call()).json()).records).toHaveLength(1);expect((await(await call('?before=1')).json()).records).toHaveLength(0);
 expect((await call('?id=999')).status).toBe(404);expect((await call('',{...payload,runId:'../../bad'})).status).toBe(400);expect((await call('',{...payload,people:Array(501).fill({})})).status).toBe(400);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('household history merges daily snapshots, deduplicates settlements and isolates runs',async()=>{
 const root=mkdtempSync(join(tmpdir(),'hbl-money-'));
 try{const handler=createEconomyRecordsHandler({root});const save=body=>handler(new Request('http://localhost/api/economy-records',{method:'POST',body:JSON.stringify(body)}));
 const record={id:'h0:day1',householdId:'h0',minute:1440,openingSavings:100,closingSavings:90,entries:[{category:'rent',amount:-10}],sources:[],events:[]};
 const snapshot={runId:'population_money_0',tick:48,minute:1440,metrics:{},people:[],events:[],households:[{id:'h0',moneyHistory:record}]};
 expect((await save(snapshot)).status).toBe(200);await save({...snapshot,tick:49});await save({...snapshot,tick:96,minute:2880,households:[{id:'h0',moneyHistory:{...record,id:'h0:day2',minute:2880,openingSavings:90,closingSavings:80}}]});
 await save({...snapshot,runId:'population_other_0'});
 const reopened=createEconomyRecordsHandler({root});const read=async run=>(await(await reopened(new Request(`http://localhost/api/economy-records?run=${run}&household=h0`))).json()).records;
 const rows=await read(snapshot.runId);expect(rows.map(r=>r.minute)).toEqual([1440,2880]);expect((await read('population_other_0')).length).toBe(1);
 expect((await read('population_missing_0')).length).toBe(0);
 const bad=await save({...snapshot,tick:200,households:[{moneyHistory:{...record,entries:[{amount:null}]}}]});expect(bad.status).toBe(400);
 }finally{rmSync(root,{recursive:true,force:true})}
});
