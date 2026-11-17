import {test,expect} from 'bun:test';
import {CONTINUITY_VERSION,parseContinuity,readContinuity,continuityURL,resolveContinuity} from '../world/continuity/contract.js';
const payload = () => ({version:CONTINUITY_VERSION,sourceSurface:'world',authority:'test:synthetic',runId:'run-A',checkpointId:'checkpoint-0',modelVersion:'test.v1',entity:{namespace:'test',kind:'building',id:'0'},camera:{mapping:'test-local',version:'v1',position:[0,10,-12.25],target:[0,0,0]},clock:{id:'test-clock',unit:'month',origin:'2026-01',tick:0}});
const authority = p => ({authority:p.authority,runId:p.runId,checkpointId:p.checkpointId,modelVersion:p.modelVersion,clock:structuredClone(p.clock),entities:[p.entity],mappings:[{id:p.camera.mapping,version:p.camera.version}]});
test('all three native routes round-trip an exact compatible receipt without changing the source',()=>{
 const p=payload(),before=JSON.stringify(p);
 for(const surface of ['world','future-machine','decision','world']) {
  const receipt=readContinuity(continuityURL(surface,p));
  expect(receipt.status).toBe('carried');expect(receipt.payload).toEqual(p);
  expect(resolveContinuity(receipt.payload,authority(p))).toEqual({status:'compatible',payload:p});
 }
 expect(JSON.stringify(p)).toBe(before);
 const parsed=parseContinuity(p);parsed.camera.position[0]=100;expect(p.camera.position[0]).toBe(0);
});
test('stale checkpoints, versions, clocks, namespaces and projections never produce compatible context',()=>{
 const p=payload();
 const cases=[['unsupported',null],['authority-mismatch',{authority:'population'}],['stale',{runId:'old'}],['stale',{checkpointId:'old'}],['model-mismatch',{modelVersion:'old'}],...['id','unit','origin','tick'].map(k=>['clock-mismatch',{clock:{...p.clock,[k]:k==='tick'?1:'other'}}]),['unresolved-entity',{entities:[{...p.entity,namespace:'population'}]}],['unsupported-mapping',{mappings:[{id:p.camera.mapping,version:'v2'}]}]];
 for(const [status,change] of cases) expect(resolveContinuity(p,change===null?null:{...authority(p),...change})).toEqual({status,payload:null});
});
test('missing, duplicate, oversized, malformed and future payloads remain explicit',()=>{
 expect(readContinuity('/world')).toEqual({status:'missing',payload:null});
 const p=payload();
 const invalid=[{...p,version:'v2'},{...p,seed:42},{...p,sourceSurface:'constructor'},{...p,clock:{...p.clock,tick:-1}},{...p,clock:{...p.clock,tick:0.5}},{...p,camera:{...p.camera,position:[0,1]}},{...p,entity:{...p.entity,id:''}}];
 for(const value of invalid) {expect(()=>parseContinuity(value)).toThrow();expect(readContinuity('/world?continuity='+encodeURIComponent(JSON.stringify(value))).status).toBe('invalid');}
 for(const url of ['/world?continuity={','/world?continuity='+ 'x'.repeat(8193),continuityURL('world',p)+'&continuity={}']) expect(readContinuity(url)).toEqual({status:'invalid',payload:null});
 expect(()=>continuityURL('https://elsewhere.test',p)).toThrow();
 expect(()=>parseContinuity({...p,camera:{...p.camera,target:[0,NaN,0]}})).toThrow();
 expect(resolveContinuity({},authority(p))).toEqual({status:'invalid',payload:null});
});
test('unselected entity and absent camera remain absent instead of invented',()=>{
 const p={...payload(),entity:null,camera:null};
 expect(resolveContinuity(p,{...authority(payload()),entities:[],mappings:[]}).payload).toEqual(p);
});
