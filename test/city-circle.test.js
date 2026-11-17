import {test,expect} from 'bun:test';
import {createCircleService} from '../world/city/circle.js';
import {createCityApi,normalizeExperiment} from '../world/city/api.js';
import {CityStore} from '../world/city/storage.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('consent, private access, evidence isolation, replacement vote, moderation, withdrawal and expiry',()=>{
 let time=0;const s=createCircleService({now:()=>time});const pin={runId:'baseline-0',evidence:[{id:'homes',value:4}]};
 expect(()=>s.create(pin,false)).toThrow('Consent');const r=s.create(pin,true);pin.evidence[0].value=999;
 expect(()=>s.act(r.id,'bad','read')).toThrow('Access');expect(()=>s.act(r.id,r.invite,'read')).toThrow('Access');
 expect(()=>s.act(r.id,r.invite,'join',{})).toThrow('Consent');
 const a=s.act(r.id,r.invite,'join',{consent:true}).member,b=s.act(r.id,r.invite,'join',{consent:true}).member;
 const claim={kind:'pro',classification:'assertion',text:'Homes increase',consent:true};
 expect(()=>s.act(r.id,a,'claim',claim)).toThrow('source');
 expect(()=>s.act(r.id,a,'claim',{...claim,source:'other-run'})).toThrow('pinned');
 let view=s.act(r.id,a,'claim',{...claim,source:'homes'});expect(view.pin.evidence[0].value).toBe(4);
 expect(()=>s.act(r.id,b,'remove',{id:view.claims[0].id})).toThrow('Access');
 s.act(r.id,a,'vote',{preference:'support',consent:true});view=s.act(r.id,a,'vote',{preference:'oppose',consent:true});expect(view.tally).toEqual({support:0,oppose:1,unsure:0});
 s.act(r.id,a,'leave');view=s.act(r.id,b,'read');expect(view.claims).toHaveLength(0);expect(view.tally.oppose).toBe(0);expect(()=>s.act(r.id,a,'read')).toThrow('Access');
 s.act(r.id,r.owner,'close');expect(()=>s.act(r.id,b,'vote',{preference:'support',consent:true})).toThrow('closed');
 s.act(r.id,r.owner,'delete-room');expect(()=>s.act(r.id,b,'read')).toThrow('unavailable');
 const expired=s.create(pin,true);time=86400001;expect(()=>s.act(expired.id,expired.owner,'read')).toThrow('expired');
});
test('bounded claims and membership',()=>{const s=createCircleService(),r=s.create({evidence:[]},true);let m;for(let i=0;i<12;i++)m=s.act(r.id,r.invite,'join',{consent:true}).member;expect(()=>s.act(r.id,r.invite,'join',{consent:true})).toThrow('full');for(let i=0;i<60;i++)s.act(r.id,m,'claim',{consent:true,kind:'question',classification:'question',text:'Why?'});expect(()=>s.act(r.id,m,'claim',{consent:true})).toThrow('limit');});
test('normal City API pins stored metrics and full manifest without modifying experiment',async()=>{
 const root=mkdtempSync(join(tmpdir(),'hbl-circle-')),store=new CityStore(root),api=createCityApi({store});
 const call=async(path,body,key)=>{const response=await api(new Request('http://local/api/city-experiments/'+path,{method:'POST',headers:key?{authorization:`Bearer ${key}`}:{},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()};};
 try{
 const {data:{id}}=await call('',{city:{households:3,seed:42},runs:1,months:1});
 for(let i=0;i<200&&store.get(id).status!=='complete';i++)await Bun.sleep(10);
 expect(store.get(id).status).toBe('complete');const before=JSON.stringify(store.get(id));
 expect((await call(id+'/circle',{scenarioId:'missing',runIndex:0,consent:true})).status).toBe(400);
 const {data:r,status}=await call(id+'/circle',{scenarioId:'baseline',runIndex:0,consent:true});expect(status).toBe(201);
 expect((await call('circles/'+r.id,{action:'read'})).status).toBe(400);
 const {data:view}=await call('circles/'+r.id,{action:'read'},r.owner);
 expect(view.pin.seed).toBe(42);expect(view.pin.manifest.version).toBe(normalizeExperiment({}).version);expect(view.pin.manifestDigest).toHaveLength(64);expect(view.pin.evidence.length).toBeGreaterThan(0);expect(JSON.stringify(store.get(id))).toBe(before);
 expect((await call('city_missing/circle',{consent:true})).status).toBe(404);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
