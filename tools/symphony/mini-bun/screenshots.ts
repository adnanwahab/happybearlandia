import path from 'node:path';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {existsSync} from 'node:fs';
export type ScreenshotConfig={command:string[];paths:string[];modulePath?:string;timeoutMs?:number};
export function validateScreenshotConfig(config:ScreenshotConfig) {
 if(!config||!Array.isArray(config.command)||!config.command.length||config.command.some(x=>typeof x!=='string'||!x)||!Array.isArray(config.paths)||!config.paths.length||config.paths.length>2||config.paths.some(p=>typeof p!=='string'||!p.startsWith('/')||p.startsWith('//')||p.includes('\\')||/[\r\n#]/.test(p))||config.timeoutMs!==undefined&&(!Number.isInteger(config.timeoutMs)||config.timeoutMs<1000||config.timeoutMs>120000))throw Error('Invalid screenshot configuration');
}
export type ScreenshotEvidence={stage?:'before'|'after';files:{path:string;route:string;viewport:string}[];capturedAt:string};
export async function captureScreenshots(workspace:string,config:ScreenshotConfig,signal?:AbortSignal,stage:'before'|'after'='after',taskId=''):Promise<ScreenshotEvidence> {
 validateScreenshotConfig(config);
 if(taskId&&!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(taskId))throw Error('Invalid screenshot task identity');
 const prefix=taskId?taskId+'-':'';
 const timeout=config.timeoutMs??60000,deadline=Date.now()+timeout;
 const sandbox=await mkdtemp(path.join(tmpdir(),'mini-screenshots-'));
 const output=path.join(workspace,'.mini-symphony-evidence');
 let child:ReturnType<typeof spawn>|undefined,browser:any;
 const stop=()=>{if(child?.pid){try{process.kill(-child.pid,'SIGTERM');}catch{try{child.kill('SIGTERM');}catch{}}}};
 const abort=()=>{stop();void browser?.close().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  if(signal?.aborted)throw Error('Screenshot capture interrupted');
  const module=config.modulePath??Bun.resolveSync('@playwright/test',import.meta.dir);
  const {chromium}=await import(module);
  const env={...Object.fromEntries(['PATH','HOME','USER','TMPDIR','TMP','TEMP','LANG'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]])),PORT:'0',NODE_ENV:'production',DB_PATH:path.join(sandbox,'db.json'),HBL_DB_PATH:path.join(sandbox,'hbl.sqlite'),HBL_WORLD_DB_PATH:':memory:',DECISION_STORE_DIR:path.join(sandbox,'decision'),HBL_JOURNAL_ROOT:path.join(sandbox,'journals'),HBL_SINGLE_WRITER:'1',HBL_KILL_SWITCH:'1',HBL_MERGE_ENABLED:'0',ANON_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),OUTCOMES_MODE:'off'};
  // Fresh detached baselines cannot inherit the source repository's node_modules.
  // Install exactly the checked-in lock, without lifecycle scripts or app secrets.
  if(existsSync(path.join(workspace,'bun.lock'))||existsSync(path.join(workspace,'bun.lockb'))){
   child=spawn(process.execPath,['--no-env-file','install','--frozen-lockfile','--ignore-scripts'],{cwd:workspace,env:{...env,NODE_ENV:'development'},detached:true,stdio:'ignore'});
   await new Promise<void>((resolve,reject)=>{
    timer=setTimeout(()=>{stop();reject(Error('Screenshot dependency installation timed out'));},Math.max(1,deadline-Date.now()));
    const interrupted=()=>reject(Error('Screenshot capture interrupted'));
    signal?.addEventListener('abort',interrupted,{once:true});
    const done=(error?:Error)=>{clearTimeout(timer);signal?.removeEventListener('abort',interrupted);error?reject(error):resolve();};
    child!.once('error',()=>done(Error('Screenshot dependency installer could not start')));
    child!.once('exit',code=>done(code===0?undefined:Error('Screenshot dependency installation failed (frozen lockfile; lifecycle scripts disabled)')));
   });
  }
  child=spawn(config.command[0],config.command.slice(1),{cwd:workspace,env,detached:true,stdio:['ignore','pipe','pipe']});
  const base=await new Promise<string>((resolve,reject)=>{
   let text='';const consume=(data:Buffer)=>{text=(text+data.toString()).slice(-4096);const match=text.match(/(?:running at|listening on)\s+http:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d+)/i);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}};
   child!.stdout?.on('data',consume);child!.stderr?.on('data',consume);
   child!.once('error',()=>reject(Error('Screenshot server could not start')));child!.once('exit',()=>reject(Error(/Could not resolve|Cannot find module/.test(text)?'Screenshot server dependency resolution failed':'Screenshot server exited before readiness')));
   timer=setTimeout(()=>reject(Error('Screenshot server startup timed out')),Math.max(1,deadline-Date.now()));
   signal?.addEventListener('abort',()=>reject(Error('Screenshot capture interrupted')),{once:true});
  });
  browser=await chromium.launch({headless:true,timeout:Math.max(1,deadline-Date.now())});
  timer=setTimeout(()=>{abort();},Math.max(1,deadline-Date.now()));
  await mkdir(output,{recursive:true});const evidence:ScreenshotEvidence={stage,capturedAt:new Date().toISOString(),files:[]};
  for(const [width,height,name] of [[1440,1000,'desktop'],[390,844,'mobile']] as const){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   // Never load production APIs or remote images while creating PR evidence.
   await context.route('**/*',route=>{const url=new URL(route.request().url());return url.origin===base||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();});
   const page=await context.newPage();
   for(let n=0;n<config.paths.length;n++){
    if(signal?.aborted||Date.now()>=deadline)throw Error('Screenshot capture interrupted or timed out');
    const route=config.paths[n],response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:Math.max(1,deadline-Date.now())});
    if(!response?.ok())throw Error('Screenshot route did not return a successful page');
    await page.locator('main, canvas, [role="main"]').first().waitFor({state:'visible',timeout:Math.max(1,deadline-Date.now())});
    await page.waitForTimeout(500);
    const file=`.mini-symphony-evidence/${prefix}${stage}-${name}-${n+1}.png`;
    await page.screenshot({path:path.join(workspace,file),fullPage:false,timeout:Math.max(1,deadline-Date.now())});evidence.files.push({path:file,route,viewport:`${name} ${width}×${height}`});
   }
   await context.close();
  }
  await writeFile(path.join(output,prefix+stage+'.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
 }finally{
  clearTimeout(timer);signal?.removeEventListener('abort',abort);await browser?.close().catch(()=>{});stop();
  if(child&&child.exitCode===null){await Promise.race([new Promise(resolve=>child!.once('close',resolve)),new Promise(resolve=>setTimeout(resolve,1000))]);if(child.exitCode===null&&child.pid){try{process.kill(-child.pid,'SIGKILL');}catch{}}}
  await rm(sandbox,{recursive:true,force:true});
 }
}
