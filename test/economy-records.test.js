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
