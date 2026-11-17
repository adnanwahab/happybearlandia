import {browserJobStatus,redactBrowserEndpoints} from './support/browser-job-result.mjs';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {chromium,firefox,webkit} from '@playwright/test';
import {acquireBrowserJob,launchReliableBrowser} from '../tools/symphony/mini-bun/browser-runtime.ts';

const args=process.argv.slice(2);
function option(name,fallback){const i=args.indexOf(name);if(i<0)return fallback;const value=args[i+1];if(!value||value.startsWith('--'))throw Error('Missing '+name);args.splice(i,2);return value;}
const config=resolve(option('--config','test/startup-smoke.config.js'));
const engines=option('--engines','chromium').split(',');
const devices=option('--devices','desktop,mobile').split(',');
const artifactParent=resolve(option('--artifacts',join(tmpdir(),'hbl-browser-jobs')));
await mkdir(artifactParent,{recursive:true});
const root=await mkdtemp(join(artifactParent,'run-'));
const suite=(await import(pathToFileURL(config).href)).default;
if(engines.some(x=>!['chromium','installed-chrome','firefox','webkit'].includes(x))||new Set(engines).size!==engines.length)throw Error('Invalid or duplicate engines');
if(devices.some(x=>!['desktop','mobile'].includes(x))||new Set(devices).size!==devices.length)throw Error('Invalid or duplicate devices');
// Only test selection flags are forwarded. Callers cannot disable traces, add
// assertion retries, increase workers or replace the browser connection.
if(args.length&&!(args.length===2&&args[0]==='--grep'))throw Error('Only --grep may be forwarded to Playwright.');
await mkdir(root,{recursive:true});
const controller=new AbortController();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
const git=args=>spawnSync('git',args,{encoding:'utf8'}).stdout?.trim()??null;
const source={commit:git(['rev-parse','HEAD']),tree:git(['rev-parse','HEAD^{tree}']),workingTreeStatus:git(['status','--porcelain'])};
const summary={config,source,startedAt:new Date().toISOString(),jobs:[]};
await writeFile(join(root,'summary.json'),JSON.stringify(summary,null,2));
const jobOutcomes=await Promise.allSettled(engines.flatMap(engine=>devices.map(async device=>{
 let artifacts=join(root,engine+'-'+device);await mkdir(artifacts,{recursive:true});
 const result={engine,device,status:'incomplete',artifacts};summary.jobs.push(result);
 let lease,launched;
 try{
  lease=await acquireBrowserJob({artifactDirectory:artifacts,signal:controller.signal});
  artifacts=lease.directory;result.artifacts=artifacts;
  const sourceProject=suite.projects?.find(project=>project.name===device);
  if(suite.projects?.length&&!sourceProject)throw Error('Suite needs an explicit '+device+' project adapter; refusing to discard project settings.');
  const sourceLaunch={...suite.use?.launchOptions,...sourceProject?.use?.launchOptions};
  const type=engine==='firefox'?firefox:engine==='webkit'?webkit:chromium;
  launched=await launchReliableBrowser(type,{artifactDirectory:artifacts,signal:controller.signal,lease,
   launchOptions:{...sourceLaunch,headless:true,executablePath:undefined,channel:engine==='installed-chrome'?'chrome':engine==='chromium'?'chromium':undefined,
    args:type===chromium?[...new Set([...(sourceLaunch.args||[]),'--enable-unsafe-webgpu','--enable-unsafe-swiftshader'])]:sourceProject?.use?.launchOptions?.args}});
  const input={config,engine,device,artifacts,wsEndpoint:launched.server.wsEndpoint()};
  result.exitCode=await new Promise((resolveExit,reject)=>{
   const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','scripts/symphony-browser-config.mjs',...args],
    {cwd:process.cwd(),env:{...process.env,HBL_BROWSER_JOB_CONFIG:JSON.stringify(input)},stdio:['ignore','pipe','pipe'],signal:controller.signal});
   let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk;process.stdout.write(chunk);});child.stderr.on('data',chunk=>{stderr+=chunk;process.stderr.write(chunk);});
   child.once('error',reject);child.once('close',async(code,signal)=>{
    try{await writeFile(join(artifacts,'test-process.json'),JSON.stringify({pid:child.pid,exitCode:code,signal,stdout,stderr},null,2));resolveExit(code);}catch(error){reject(error);}
   });
  });
  const report=JSON.parse(await readFile(join(artifacts,'results.json'),'utf8'));
  await writeFile(join(artifacts,'results.json'),JSON.stringify(redactBrowserEndpoints(report),null,2));
  result.stats=report.stats;
  result.status=browserJobStatus(result.exitCode,report.stats);
 }catch(error){result.error=String(error?.stack||error);}
 finally{
  try{await launched?.close();}catch(error){if(result.status!=='failed')result.status='incomplete';result.cleanupError=String(error);}
  try{await lease?.release();}catch(error){if(result.status!=='failed')result.status='incomplete';result.releaseError=String(error);}
  try{await writeFile(join(artifacts,'status.json'),JSON.stringify(result,null,2));}catch(error){if(result.status!=='failed')result.status='incomplete';result.artifactError=String(error);}
 }
})));
summary.orchestrationErrors=jobOutcomes.filter(outcome=>outcome.status==='rejected').map(outcome=>String(outcome.reason));
summary.finishedAt=new Date().toISOString();await writeFile(join(root,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
process.exitCode=!summary.orchestrationErrors.length&&summary.jobs.length===engines.length*devices.length&&summary.jobs.every(job=>job.status==='passed')?0:1;
