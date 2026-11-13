import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDetectiveHandler} from '../ops/detective/api.js';
import {stateHash} from '../world/future-machine/data/core.js';
test('saved ID only, allowlisted evidence, immutable hash-verified reveal and restart',async()=>{
 const root=mkdtempSync(join(tmpdir(),'detective-'));try{
 let handle=createDetectiveHandler({root});const call=async(path='',body)=>{const r=await handle(new Request('http://local/api/detective'+path,body===undefined?{}:{method:'POST',body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};};
 for(let caseIndex=0;caseIndex<5;caseIndex++){
 const {data:{experimentId:id}}=await call('',{caseIndex});const p=(await call('/'+id)).data;
 expect(p.choices).toHaveLength(4);expect(p.month).toBe(120);
 const hidden=JSON.stringify(p);for(const word of ['recipe','seed','intervention','answer','hash'])expect(hidden.includes('"'+word+'"')).toBe(false);
 for(const step of ['inventory','inventory','trail']){const e=(await call('/'+id+'/evidence',{step})).data;expect(JSON.stringify(e)).not.toContain('"record"');expect(JSON.stringify(e)).not.toContain('"amount"');}
 expect((await call('/'+id)).data.evidenceSteps).toBe(2);
 const correct=[24,48,12,36,24][caseIndex],choice=p.choices.find(c=>c.label.startsWith('Authorize '+correct+' '));
 const result=await call('/'+id+'/answer',{choiceId:choice.id});expect(result.status).toBe(200);expect(result.data.correct).toBe(true);expect(result.data.completedWithEvidence).toBe(true);expect(result.data.recipeHash).toBe(await stateHash(result.data.receipt.evidence.recipe));
 expect((await call('/'+id+'/answer',{choiceId:'wrong'})).data).toEqual(result.data);
 handle=createDetectiveHandler({root});expect((await call('/'+id)).data.reveal).toEqual(result.data);
 }
 const {data:{experimentId:badId}}=await call('',{caseIndex:0});
 expect((await call('/'+badId+'/evidence',{step:'recipe'})).status).toBe(400);
 expect((await call('/'+badId+'/answer',{choiceId:'invalid'})).status).toBe(400);
 const badPuzzle=(await call('/'+badId)).data;
 const wrong=badPuzzle.choices.find(c=>c.label.startsWith('Authorize 12 '));
 const failed=(await call('/'+badId+'/answer',{choiceId:wrong.id})).data;
 expect(failed.correct).toBe(false);expect(failed.score).toBe(0);
 await call('/'+badId+'/evidence',{step:'completion'});
 expect((await call('/'+badId)).data.evidenceSteps).toBe(0);
 const metrics=(await call()).data;expect(metrics.started).toBe(6);expect(metrics.completedWithTwoEvidenceSteps).toBe(5);
 expect((await call('',{caseIndex:5})).status).toBe(400);expect((await call('/unknown')).status).toBe(404);
 }finally{rmSync(root,{recursive:true,force:true});}
});
