// bun scripts/benchmark-interaction-ablation.js [10000,100000] [42,43,44,45,46] [days=1] [output.json]
import {writeFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import os from 'node:os';
import {normalizeExperiment,runTransportArm,summarizeExperiment} from '../world/research/interaction-ablation.js';
import {TRANSPORT_ARMS} from '../world/population/transport-experiment.js';
const args=process.argv.slice(2);
if(args.length>4)throw Error('Expected populations, seeds, days, output');
const settings=normalizeExperiment({populations:(args[0]??'10000,100000').split(',').map(Number),seeds:(args[1]??'42,43,44,45,46').split(',').map(Number),days:Number(args[2]??1)});
// Pin sources before execution and reject concurrent edits before publication.
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function sourceHashes(){
 const hashes={};
 async function walk(dir){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(path);else if(entry.name.endsWith('.js'))hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');}}
 await walk('world');
 hashes['scripts/benchmark-interaction-ablation.js']=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
 return hashes;
}
const initialSourceHashes=await sourceHashes();
const runs=[],measurements=[],start=performance.now();
for(const population of settings.populations)for(const seed of settings.seeds)for(const arm of TRANSPORT_ARMS){
 const at=performance.now();runs.push(runTransportArm({population,seed,days:settings.days,arm}));
 measurements.push({population,seed,arm,wallMs:performance.now()-at});
 console.error(JSON.stringify(measurements.at(-1)));
 // Bound retained hot state to one arm when run under Bun.
 globalThis.Bun?.gc(true);
}
const report={...summarizeExperiment(settings,runs),execution:{capturedAt:new Date().toISOString(),wallMs:performance.now()-start,
 runtime:process.versions,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,
 modelSourceDigest:'See sourceHashes',measurements,measurement:'Sequential headless actual Population model; includes generation, graph observation and state hashing; not a throughput benchmark'},
 sourceHashes:{}};
const finalSourceHashes=await sourceHashes();
if(JSON.stringify(initialSourceHashes)!==JSON.stringify(finalSourceHashes))throw Error('Source changed during experiment; report rejected');
report.sourceHashes=initialSourceHashes;
const json=JSON.stringify(report,null,2)+'\n';
if(args[3]){const target=resolve(args[3]),temporary=`${target}.${process.pid}.tmp`;try{await writeFile(temporary,json,{flag:'wx'});await rename(temporary,target);}finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}}
else process.stdout.write(json);
