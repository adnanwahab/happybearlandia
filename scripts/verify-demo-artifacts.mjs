#!/usr/bin/env bun
// Validate collected browser artifacts; this does not substitute for running E2E.
import {readdir,readFile,stat,writeFile} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
if(process.argv.includes('--help')){console.log('Usage: bun scripts/verify-demo-artifacts.mjs ARTIFACT_DIRECTORY');process.exit(0);}
const root=resolve(process.argv[2]||'/tmp/hbl-two-futures-acceptance');
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(join(dir,e.name)):join(dir,e.name)))).flat();}
const files=await walk(root),records=[];
for(const file of files.filter(p=>p.endsWith('.json'))){let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch{continue;}if(data.schemaVersion!=='two-futures-browser-evidence.v1')continue;
 const recipe=data.recipe||data.scenario,metrics=data.diff?.metrics;
 if(recipe?.seed!==data.seed||recipe.modelVersion!==data.modelVersion||!data.initialHash||!data.experimentId)throw Error(`Missing/mismatched provenance: ${file}`);
 if(data.baseline.month!==data.selectedMonth||data.plan.month!==data.selectedMonth)throw Error(`Mismatched selected clock: ${file}`);
 if(metrics.housingUnits.delta!==data.plan.state.units.length-data.baseline.state.units.length)throw Error(`Housing KPI differs from recorded inventory: ${file}`);
 if(data.selectedMonth===0&&JSON.stringify(data.baseline.state)!==JSON.stringify(data.plan.state))throw Error(`Unequal original snapshots: ${file}`);
 const screenshot=file.replace(/\.json$/,'.png'),png=await readFile(screenshot);
 if(png.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error(`Missing PNG: ${screenshot}`);
 records.push({file:basename(file),experimentId:data.experimentId,seed:data.seed,modelVersion:data.modelVersion,initialHash:data.initialHash,month:data.selectedMonth,firstDivergence:data.firstDivergence??null,metrics,backend:data.scene?.backend,camera:data.camera,png:{path:screenshot,width:png.readUInt32BE(16),height:png.readUInt32BE(20)}});
}
if(!records.length)throw Error('No actual browser evidence records found. Run the Playwright journey first.');
const videos=[];for(const path of files.filter(p=>p.endsWith('.webm'))){if(!(await stat(path)).size)throw Error(`Empty browser video: ${path}`);const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',path],{encoding:'utf8'}).trim());if(!Number.isFinite(duration)||duration<=0)throw Error(`Unplayable video: ${path}`);videos.push({path,durationSeconds:duration});}
const report={schemaVersion:'hbl-demo-artifact-audit.v1',root,records,videos,limitation:'Structural artifact validation only. Browser test results and visual inspection establish interaction evidence; fixture images are not accepted as substitutes.'};
await writeFile(join(root,'artifact-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({records:records.length,videos:videos.length,months:[...new Set(records.map(r=>r.month))],output:join(root,'artifact-audit.json')},null,2));
