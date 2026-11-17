import {test,expect} from 'bun:test';
import {createGuestHandler} from '../world/guest/api.js';
import {createCity} from '../world/city/seed.js';
import {normalizeRealityRequest,simulateRealityPair} from '../world/reality/runtime-core.js';
const manifest=normalizeRealityRequest({initial:createCity({households:3}),program:{engine:'city',parameterPatch:{permits:6}},runs:1,months:1,seed:42,parameterUncertainty:[]});
const run=await simulateRealityPair(manifest,0);
const input={manifest,run,publishConsent:true,rightsConfirmed:true,ttlSeconds:60};
const req=(method='GET',credential,body,path='/api/guest-snapshots')=>new Request('http://local'+path,{method,headers:{...(credential?{Authorization:`Bearer ${credential}`} :{})},...(body?{body:JSON.stringify(body)}:{})});
test('guest snapshot capability scopes reads, denies enumeration/mutation, revokes and expires',async()=>{
 let time=1000000;const h=createGuestHandler({dbPath:':memory:',now:()=>time});
 try{
  const response=await h(req('POST',null,input));expect(response.status).toBe(201);const created=await response.json();const view=created.url.split('#')[1];
  const loaded=await(await h(req('GET',view))).json();expect(loaded.result.manifest).toEqual(manifest);expect(loaded.result.runs[0].seed).toBe(run.seed);expect(loaded.forkAllowed).toBe(false);expect(loaded.revokeToken).toBeUndefined();
  for(const credential of [null,created.revokeToken,view.slice(0,-1)+(view.endsWith('A')?'B':'A'),'../private'])expect((await h(req('GET',credential))).status).toBe(404);
  expect((await h(req('GET',view,null,'/api/guest-snapshots/private'))).status).toBe(404);
  for(const method of ['PUT','PATCH'])expect((await h(req(method,view,{run:{}}))).status).toBe(405);
  expect((await h(req('DELETE',view))).status).toBe(404);expect(await(await h(req('GET',view))).json()).toEqual(loaded);
  expect((await h(req('DELETE',created.revokeToken))).status).toBe(200);expect((await h(req('GET',view))).status).toBe(404);
  const second=await(await h(req('POST',null,input))).json();time+=60000;expect((await h(req('GET',second.url.split('#')[1]))).status).toBe(404);
  expect(manifest).toEqual(input.manifest);
 }finally{h.close();}
});
test('publication requires consent, rights, bounded expiry and consistent run; storage bounded',async()=>{
 const h=createGuestHandler({dbPath:':memory:',maxRecords:1});try{
  for(const patch of [{publishConsent:false},{rightsConfirmed:false},{ttlSeconds:0},{ttlSeconds:86401},{run:{...run,seed:123}},{manifest:{...manifest,id:'tampered'}}])expect((await h(req('POST',null,{...input,...patch}))).status).toBe(400);
  const cross=req('POST',null,input);cross.headers.set('origin','https://other');expect((await h(cross)).status).toBe(403);
  expect((await h(req('POST',null,input))).status).toBe(201);expect((await h(req('POST',null,input))).status).toBe(507);
 }finally{h.close();}
});
test('snapshot and revocation survive reopening a disk store',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'hbl-guest-'));const dbPath=join(dir,'guest.sqlite');let h=createGuestHandler({dbPath});
 try{const created=await(await h(req('POST',null,input))).json();const view=created.url.split('#')[1];h.close();h=createGuestHandler({dbPath});expect((await h(req('GET',view))).status).toBe(200);expect((await h(req('DELETE',created.revokeToken))).status).toBe(200);h.close();h=createGuestHandler({dbPath});expect((await h(req('GET',view))).status).toBe(404);}finally{h.close();rmSync(dir,{recursive:true,force:true});}
});
