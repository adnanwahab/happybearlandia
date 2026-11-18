import { test, expect } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductWorkflowStore, createProductWorkflowHandler } from '../world/decision/backlog-product-workflows/index.js';
const input = { key:'request1', kind:'pilot', brief:'Review housing pilot', consent:true, reviewed:true };
test('real disk retention, restart, bounded capacity, consent and idempotency', async () => {
 const directory = await mkdtemp(join(tmpdir(),'hbl-product-')); let store;
 try {
 let time=100; const options={directory,now:()=>time,retentionMs:100,capacity:1}; store=createProductWorkflowStore(options);
 expect(()=>store.submit('owner',{...input,consent:false})).toThrow();
 expect(()=>store.submit('owner',{...input,reviewed:false})).toThrow();
 const record=store.submit('owner',input);
 expect(store.submit('owner',input).id).toBe(record.id);
 expect(()=>store.submit('owner',{...input,brief:'changed'})).toThrow('conflict');
 expect(()=>store.submit('owner',{...input,key:'second'})).toThrow('capacity');
 store.close(); store=createProductWorkflowStore(options);
 expect(store.export('owner')[0]).toEqual(record);
 expect(store.export('other')).toEqual([]);
 time=200; expect(store.export('owner')).toEqual([]);
 store.submit('owner',{key:'event',kind:'event',event:'studio_opened',consent:true,reviewed:true});
 expect(store.delete('owner')).toEqual({deleted:1}); expect(store.export('owner')).toEqual([]);
 expect(()=>store.submit('owner',{...input,owner:'forged'})).toThrow();
 expect(()=>store.submit('owner',{...input,brief:'x'.repeat(4001)})).toThrow();
 } finally {store?.close();await rm(directory,{recursive:true,force:true});}
});
test('actual HTTP endpoint: local-only receipt, auth, validation, export/delete and safe failure', async () => {
 const directory=await mkdtemp(join(tmpdir(),'hbl-product-http-')); const store=createProductWorkflowStore({directory});
 const handler=createProductWorkflowHandler({store,authorize:r=>r.headers.get('authorization')==='Bearer local-test'?'owner':null});
 const server=Bun.serve({port:0,hostname:'127.0.0.1',fetch:async r=>await handler(r)||new Response('Missing',{status:404})});
 const url=`http://127.0.0.1:${server.port}/api/product-workflows`;
 const headers={authorization:'Bearer local-test','content-type':'application/json'};
 try {
 expect((await fetch(url)).status).toBe(401);
 const replies=await Promise.all([1,2].map(()=>fetch(url,{method:'POST',headers,body:JSON.stringify(input)}).then(r=>r.json())));
 expect(replies[0].id).toBe(replies[1].id); expect(replies[0].externalSubmission).toBe(false); expect(replies[0].status).toBe('stored-locally');
 expect((await fetch(url,{method:'POST',headers,body:'{'})).status).toBe(400);
 expect((await fetch(url,{method:'POST',headers,body:JSON.stringify({...input,brief:'x'.repeat(17000)})})).status).toBe(413);
 expect((await (await fetch(url,{headers})).json()).records.length).toBe(1);
 expect((await (await fetch(url,{method:'DELETE',headers})).json()).deleted).toBe(1);
 expect((await fetch(url,{method:'PATCH',headers})).status).toBe(405);
 store.close(); const failed=await fetch(url,{headers}); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain(directory);
 } finally {server.stop(true);await rm(directory,{recursive:true,force:true});}
});
test('reject public directories and corrupt disk without silently erasing records', async()=>{
 expect(()=>createProductWorkflowStore({directory:'world/private-workflows'})).toThrow('private');
 const directory=await mkdtemp(join(tmpdir(),'hbl-product-corrupt-'));
 try {await writeFile(join(directory,'product-workflows.sqlite'),'corrupt');expect(()=>createProductWorkflowStore({directory})).toThrow();}
 finally {await rm(directory,{recursive:true,force:true});}
});
