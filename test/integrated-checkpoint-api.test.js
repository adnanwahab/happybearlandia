import {test,expect} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createCheckpointHandler} from '../world/decision/checkpoint-api.js';import {simulateHousingRun,createHousingScenarios} from '../world/models/housing/index.js';
test('normal checkpoint handler persists, reloads and approves nested branches',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'checkpoint-api-'));try{
 const scenario=createHousingScenarios()[0],parameters=scenario.parameters;const original=simulateHousingRun({parameters,seed:0,years:10});const run={...original,id:'run1',modelVersion:'1.2.0',status:'completed',sampledParameters:parameters,seed:0,scenarioId:scenario.id};
 const handler=createCheckpointHandler({directory,authorize:r=>r.headers.get('x-test-owner'),store:{load:async()=>({experiment:{years:10,scenarios:[scenario]},runs:[run]})}});
 const call=async payload=>{const response=await handler(new Request('http://localhost/api/decision-checkpoints',{method:'POST',headers:{'content-type':'application/json','x-test-owner':'owner1'},body:JSON.stringify({experimentId:'exp1',runId:'run1',...payload})}));return {status:response.status,body:await response.json()};};
 let value=await call({action:'start',month:24});expect(value.status).toBe(201);let checkpoint={id:value.body.checkpoint.id,digest:value.body.checkpoint.digest};
 expect((await call({action:'load',checkpoint})).status).toBe(200);
 for(const month of [48,72]){const operations=[];const preview=await call({action:'fork',checkpoint,month,operations});expect(preview.body.requiresApproval).toBe(true);value=await call({action:'fork',checkpoint,month,operations,approval:true,previewHash:preview.body.previewHash});expect(value.status).toBe(201);checkpoint={id:value.body.checkpoint.id,digest:value.body.checkpoint.digest};}
 expect((await call({action:'resume',checkpoint,month:120})).status).toBe(201);
 }finally{await rm(directory,{recursive:true,force:true});}
});
