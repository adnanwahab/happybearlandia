/** Local API serialization/parse/memory prototype. No viewer or mobile claim. */
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createPolicyPreviewHandler} from '../../world/policy-preview-api.js';
const directory=mkdtempSync(join(tmpdir(),'policy-benchmark-'));
const h=createPolicyPreviewHandler({directory,token:'benchmark-local',canonicalOrigin:'https://benchmark.invalid'});
const request=path=>h(new Request(`https://benchmark.invalid/api/policy-previews/${path}`));
const input=JSON.parse(readFileSync(new URL('../../world/policy-preview-demo.json',import.meta.url)));
input.simulation={seed:42,runs:100,months:24};
try{
 const start=performance.now(),before=process.memoryUsage();
 const created=await h(new Request('https://benchmark.invalid/api/policy-previews',{method:'POST',headers:{authorization:'Bearer benchmark-local'},body:JSON.stringify(input)}));
 const {id}=await created.json();let manifest;
 for(let i=0;i<10000;i++){manifest=await(await request(id)).json();if(!['queued','running'].includes(manifest.job.status))break;await Bun.sleep(10);}
 if(manifest.job.completed!==100)throw Error('100 successful pairs required');
 const executionMs=performance.now()-start;Bun.gc(true);const resident=process.memoryUsage();
 const measurements={};
 for(const [name,path] of [['summary',`${id}/summary?limit=100`],['full',`${id}/results`],['pair99',`${id}/results?runIndex=99`]]){
  Bun.gc(true);const memoryBefore=process.memoryUsage(),t=performance.now(),response=await request(path),text=await response.text(),serializeMs=performance.now()-t;
  const parseStart=performance.now(),parsed=JSON.parse(text),parseMs=performance.now()-parseStart;
  const after=process.memoryUsage();measurements[name]={status:response.status,bytes:Buffer.byteLength(text),serializeMs,parseMs,heapDelta:after.heapUsed-memoryBefore.heapUsed,rssDelta:after.rss-memoryBefore.rss};
  if(!parsed.id)throw Error('Missing identity');
 }
 console.log(JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()?'modified':'clean',bun:Bun.version,id,modelVersion:manifest.modelVersion,simulation:input.simulation,derivedSeeds:'deriveSeed(42, runIndex), indices 0..99',job:manifest.job,executionMs,memory:{before,resident},measurements,transport:'in-process Request/Response; serialization + body read, not wire latency',firstUsefulRender:'NOT RUN: SHE-1042',mobile:'NOT RUN: SHE-1042'},null,2));
}finally{rmSync(directory,{recursive:true,force:true});}
