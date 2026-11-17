import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('allocated URL and disposable database reach the real worker',async({request,baseURL},info)=>{
 const descriptor=info.config.metadata.browserEnvironments[0];
 expect(baseURL).toBe(`http://127.0.0.1:${descriptor.port}`);
 const initial=await(await request.get('/')).json();expect(initial.count).toBe(0);expect(initial.id).toBe(info.config.metadata.runId);
 const record=await(await request.get('/record')).json();expect(record.count).toBe(1);expect(record.host).toBe('127.0.0.1');expect(String(record.port)).toBe(descriptor.port);expect(record.worldDb).toBe(info.config.webServer.env.HBL_WORLD_DB_PATH);
 writeFileSync(process.env.HBL_BROWSER_ISOLATION_REPORT,JSON.stringify({...record,store:descriptor.store,baseURL}));
});
