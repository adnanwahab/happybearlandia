// bun scripts/benchmark-residents.js [1000,10000,100000] [repetitions>=3]
import os from 'node:os';
import {serialize} from 'node:v8';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createPopulationModel,stepPopulation,snapshotPopulation,serializePopulation} from '../world/population/model.js';
import {fullSort,heap,insertion,partition} from './performance/selection-alternatives.js';
const [sizes='1000,10000,100000',reps='5']=process.argv.slice(2),counts=sizes.split(',').map(Number),repetitions=Number(reps);
if(counts.some(n=>!Number.isInteger(n)||n<10||n>100000)||!Number.isInteger(repetitions)||repetitions<3||repetitions>20)throw Error('Use counts 10–100000 and repetitions 3–20');
const context={id:'she236-synthetic.v1',districts:[{id:'home',x:0,z:0,transit:.6,services:.7},{id:'jobs',x:1800,z:0,transit:.8,services:.8}],provenance:{type:'synthetic-benchmark',calibrated:false}};
const view={x:0,z:0},selectors={fullSort,heap,insertion,partition},reports=[];
const measure=fn=>{const start=performance.now(),value=fn();return{ms:performance.now()-start,value};};
const stats=values=>{const s=[...values].sort((a,b)=>a-b);return{samplesMs:values,p50Ms:s[Math.floor(s.length*.5)],p95Ms:s[Math.min(s.length-1,Math.floor(s.length*.95))]};};
function bytes(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return 0;seen.add(value);if(ArrayBuffer.isView(value)){if(seen.has(value.buffer))return 0;seen.add(value.buffer);return value.buffer.byteLength;}if(value instanceof ArrayBuffer)return value.byteLength;return Object.values(value).reduce((n,v)=>n+bytes(v,seen),0);}
for(const population of counts){
 const samples={generation:[],step:[],snapshot:[],clone:[],json:[]},selection=Object.fromEntries(Object.keys(selectors).map(k=>[k,[]]));let referenceHash=null,report;
 for(let run=-1;run<repetitions;run++){
  const generated=measure(()=>createPopulationModel({population,seed:42},context,{initialMinute:360,initialTick:360})),model=generated.value;
  const steps=[];for(let tick=361;tick<=376;tick++)steps.push(measure(()=>stepPopulation(model,{tick,minutes:1})).ms);
  // Every repeat regenerates and executes exactly the same sixteen fixed commits.
  const expected=fullSort(model.people,500,view);
  for(const [name,select] of Object.entries(selectors).sort((a,b)=>((run+1)%2?1:-1)*a[0].localeCompare(b[0]))){const t=measure(()=>select(model.people,500,view));if(JSON.stringify(t.value)!==JSON.stringify(expected))throw Error(`${name} mismatch`);if(run>=0)selection[name].push(t.ms);}
  const snapshot=measure(()=>snapshotPopulation(model,{visibleLimit:500,view,trackSelected:false}));
  const clone=measure(()=>structuredClone(snapshot.value)),json=measure(()=>JSON.stringify(snapshot.value));
  const hash=createHash('sha256').update(serialize(serializePopulation(model))).digest('hex');if(referenceHash&&hash!==referenceHash)throw Error('Deterministic replay mismatch');referenceHash=hash;
  if(run>=0){samples.generation.push(generated.ms);samples.step.push(...steps);samples.snapshot.push(snapshot.ms);samples.clone.push(clone.ms);samples.json.push(json.ms);}
  report={population,modelVersion:model.modelVersion,seed:42,initialMinute:360,finalMinute:model.minute,steps:16,stepMinutes:1,visibleAvatars:null,displayRows:snapshot.value.visibleAgents.length,interactions:null,deterministicStateHash:hash,hashEncoding:'node:v8 serialize of serializePopulation',typedBufferBytes:bytes(model),snapshotJsonBytes:Buffer.byteLength(json.value),validation:model.validation,processMemory:process.memoryUsage()};
 }
 reports.push({...report,phases:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,stats(v)])),selection:Object.fromEntries(Object.entries(selection).map(([k,v])=>[k,stats(v)]))});
 console.error(`Measured ${population} residents`);
}
console.log(JSON.stringify({schemaVersion:'she236-resident-lab.v1',capturedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(['world/population/visible-sample.js','world/activity-history.js','scripts/benchmark-residents.js'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),machine:{cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,memoryBytes:os.totalmem(),platform:os.platform(),release:os.release(),arch:os.arch(),runtime:process.versions},repetitions,warmupRunsPerSize:1,context,view,reports,limitations:['Synthetic two-district morning workload; not calibrated or a resident ceiling.','Phase timings exclude validation/hash/export; step includes normal metrics/history.','Clone is an in-process structuredClone proxy, not measured worker transfer latency.','Typed bytes exclude objects; process memory is sampled, shared across phases, not peak/per-model memory.','No browser, GPU synchronization, draw calls, rendered FPS, main-thread latency or pairwise interaction throughput measured.','All alternatives select identical display IDs; they do not change simulation cadence or model rules.']},null,2));
