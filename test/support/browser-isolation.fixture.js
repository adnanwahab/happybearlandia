import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('allocated URL and disposable database reach the real worker',async({request,baseURL},info)=>{
 const descriptor=info.config.metadata.browserEnvironments[0];
 expect(baseURL).toBe(`http://127.0.0.1:${descriptor.port}`);
 const initial=await(await request.get('/')).json();expect(initial.count).toBe(0);expect(initial.id).toBe(info.config.metadata.runId);
 expect(initial.guestCount).toBe(0);expect(initial.guestDb).toBe(info.config.webServer.env.HBL_GUEST_DB_PATH);
 const created=await request.post('/api/guest-snapshots',{data:initial.guestInput});expect(created.status()).toBe(201);
 const snapshot=await created.json(),view=snapshot.url.split('#')[1];
 const loaded=await request.get('/api/guest-snapshots',{headers:{Authorization:`Bearer ${view}`}});expect(loaded.status()).toBe(200);expect((await loaded.json()).result.manifest.id).toBe(initial.guestInput.manifest.id);
 const record=await(await request.get('/record')).json();expect(record.count).toBe(1);expect(record.host).toBe('127.0.0.1');expect(String(record.port)).toBe(descriptor.port);expect(record.worldDb).toBe(info.config.webServer.env.HBL_WORLD_DB_PATH);
 expect(record.guestCount).toBe(1);expect(record.guestDb).toBe(initial.guestDb);
 const {guestInput,...receipt}=record;writeFileSync(process.env.HBL_BROWSER_ISOLATION_REPORT,JSON.stringify({...receipt,store:descriptor.store,baseURL}));
});
