#!/usr/bin/env bun
// Local-only coordinator. No shell interpolation, remote Git operations or recursive agents.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const SELF = fileURLToPath(import.meta.url);
export const atomic = (file, value) => { fs.mkdirSync(path.dirname(file), {recursive:true}); const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n'); fs.renameSync(tmp,file); };
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
const alive = pid => { try { process.kill(pid,0); return true; } catch { return false; } };
export function lock(dir) {
  fs.mkdirSync(path.dirname(dir),{recursive:true});
  try { fs.mkdirSync(dir); } catch { throw Error(`Coordinator lock exists: ${dir}. Inspect owner.json and retained workers; remove only after confirming every process is stopped.`); }
  atomic(path.join(dir,'owner.json'),{pid:process.pid,startedAt:new Date().toISOString()});
  return () => fs.rmSync(dir,{recursive:true});
}
function git(cwd,...args) {
  const r=spawnSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd,encoding:'utf8',timeout:10000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
  if(r.status!==0) throw Error(`git ${args[0]}: ${r.stderr || r.error}`);
  return r.stdout.trim();
}
export function parseBacklog(text) {
  const rows=[];
  for(const line of text.split('\n')) {
    const c=line.split('|').map(x=>x.trim());
    const identity=c[1]?.match(/^([RUD]\d+)(?: \/ ([RUD]\d+))?$/);
    if(!identity) continue;
    c[1]=identity[1];
    const status=c[2]?.match(/\b(READY|UPCOMING|RUNNING|REVIEW|VERIFIED|BLOCKED)\b/)?.[1];
    if(!status) continue;
    if(rows.some(t=>t.id===c[1])) throw Error(`Duplicate backlog ID ${c[1]}`);
    rows.push({id:c[1],priority:c[2].match(/P\d/)?.[0]||'P2',sourceStatus:status,acceptance:c[3],sourceDependencies:c[4]});
  }
  // Narrative-only assignments are visible but never executable without normalized approval rows.
  for(const [id] of text.matchAll(/\b[RUD]\d{2}\b/g)) if(!rows.some(t=>t.id===id)) rows.push({id,priority:'P2',sourceStatus:'UNSTRUCTURED',acceptance:'Narrative/compound backlog reference; normalize ownership, status and acceptance before dispatch',sourceDependencies:''});
  return rows;
}
export function queue(backlog, manifest) {
  const tasks=parseBacklog(backlog), ids=new Set(tasks.map(t=>t.id));
  for(const id of Object.keys(manifest.tasks)) if(!ids.has(id)) throw Error(`Execution metadata has no approved backlog row: ${id}`);
  return tasks.map(t=> {
    const m=manifest.tasks[t.id];
    if(t.sourceStatus==='VERIFIED') return {...t,status:'BASELINE',files:[],dependencies:[],attempts:0};
    if(m && Object.keys(m).some(k=>!['kind','files','interfaces','dependencies','tests','browserTests','userFacing'].includes(k))) throw Error(`Unknown metadata field ${t.id}`);
    if(!m || !['READY','UPCOMING'].includes(t.sourceStatus)) return {...t,status:'BLOCKED',reason:m?'Existing external assignment/status':'Needs explicit ownership and checks',files:[],dependencies:[],attempts:0};
    if(!['feature','verification'].includes(m.kind)||!Array.isArray(m.interfaces||[])||(m.interfaces||[]).some(i=>typeof i!=='string'||!i)) throw Error(`Invalid kind/interfaces ${t.id}`);
    if(!Array.isArray(m.files)||!m.files.length||m.files.some(f=>!f||f.startsWith('/')||f.split('/').some(p=>p==='.'||p==='..'||!p)||/[\*?{]/.test(f)||f.startsWith('.git')||f.startsWith('.codex')||f.startsWith('.agents')||f==='AGENTS.md')) throw Error(`Invalid file reservation ${t.id}`);
    if(!Array.isArray(m.dependencies)||m.dependencies.some(d=>!ids.has(d))) throw Error(`Unknown dependency ${t.id}`);
    const sourceDeps=[...t.sourceDependencies.matchAll(/\b[RUD]\d+\b/g)].map(x=>x[0]);
    if(sourceDeps.some(d=>!m.dependencies.includes(d))) throw Error(`Missing source dependency ${t.id}`);
    for(const cmd of [...(m.tests||[]),...(m.browserTests||[])]) if(!Array.isArray(cmd)||!cmd.length||cmd.some(a=>typeof a!=='string')) throw Error(`Invalid check argv ${t.id}`);
    if(!m.tests?.length || (m.userFacing && !m.browserTests?.length)) throw Error(`Missing required checks ${t.id}`);
    return {...t,...m,status:t.sourceStatus,attempts:0,claimedOwner:null};
  });
}
export const overlaps = (a,b) => { a=a.toLowerCase().replace(/\/$/,'');b=b.toLowerCase().replace(/\/$/,'');return a===b||a.startsWith(b+'/')||b.startsWith(a+'/'); };
export function select(tasks, max, frozen=false) {
  const occupied=tasks.filter(t=>['RUNNING','VERIFYING','PENDING_INTEGRATION','INTEGRATING','INTERRUPTED'].includes(t.status));
  const picked=[];
  for(const t of [...tasks].sort((a,b)=>a.priority.localeCompare(b.priority)||a.id.localeCompare(b.id))) {
    if(picked.length+occupied.filter(t=>t.status==='RUNNING').length>=max) break;
    if(!['READY','UPCOMING'].includes(t.status)||frozen&&t.kind!=='verification') continue;
    if(!t.dependencies.every(d=>['VERIFIED','BASELINE'].includes(tasks.find(x=>x.id===d)?.status))) continue;
    if([...occupied,...picked].some(o=>t.files.some(f=>o.files.some(g=>overlaps(f,g))) || (t.interfaces||[]).some(i=>(o.interfaces||[]).includes(i)))) continue;
    picked.push(t);
  }
  return picked;
}
const hash = x => createHash('sha256').update(x).digest('hex');
export function report(state,root,dir) {
  state.updatedAt=new Date().toISOString(); state.elapsedSeconds=Math.max(0,Math.round((Date.now()-state.startedAt)/1000));
  atomic(path.join(dir,'status.json'),state);atomic(path.join(root,'docs/pipeline-status.json'),state);
  const group=s=>state.tasks.filter(t=>s.includes(t.status)).map(t=>`${t.id}${t.claimedOwner?` (${t.claimedOwner})`:''}${t.reason?`: ${t.reason}`:''}`).join('; ')||'None';
  atomic(path.join(root,'docs/pipeline-status.md'),`# Local task pipeline\n\nMode: ${state.mode}; elapsed: ${state.elapsedSeconds}s; deadline: ${new Date(state.deadline).toISOString()}\n\n- Active workers: ${group(['RUNNING','VERIFYING','INTERRUPTED'])}\n- READY/upcoming: ${group(['READY','UPCOMING'])}\n- BLOCKED: ${group(['BLOCKED'])}\n- Completed and verified this run: ${group(['VERIFIED'])}\n- Baseline verified (not executed here): ${group(['BASELINE'])}\n- Pending integration: ${group(['PENDING_INTEGRATION','INTEGRATING'])}\n- Last tests: ${JSON.stringify(state.lastTests||'Not run')}\n- Last visible improvement: ${state.lastImprovement||'None measured by this run'}\n- Next action: ${state.nextAction||'Select eligible approved work'}\n\nMachine state/logs: ${dir}\nCoordinator: ${state.coordinator||'not created'}\nDry-run does not launch processes or claim completion. Retained worktrees are never deleted.\n`);
}
// Every subprocess has a hard deadline and a process group, including sandboxed tests.
export function command(argv,cwd,log,deadline,onSpawn=()=>{}) {
  return new Promise(resolve=> {
    const start=Date.now(); fs.mkdirSync(path.dirname(log),{recursive:true}); const fd=fs.openSync(log,'a');
    if(start>=deadline) { fs.closeSync(fd); resolve({argv,exitCode:null,timedOut:true,start,end:start,log}); return; }
    let child;
    try { child=spawn(argv[0],argv.slice(1),{cwd,detached:true,stdio:['ignore',fd,fd],env:{PATH:process.env.PATH,HOME:process.env.HOME,CODEX_HOME:process.env.CODEX_HOME,TMPDIR:process.env.TMPDIR,LANG:'en_US.UTF-8',GIT_TERMINAL_PROMPT:'0'}}); }
    catch(e) { fs.closeSync(fd); resolve({argv,exitCode:null,error:String(e),start,end:Date.now(),log}); return; }
    let timedOut=false,done=false;
    const kill=()=> { try { process.kill(-child.pid,'SIGKILL'); } catch {} };
    const timer=setTimeout(()=>{timedOut=true;kill();},Math.min(deadline-start,2147483647));
    const finish=(code,signal,error)=> { if(done)return;done=true;clearTimeout(timer);kill();fs.closeSync(fd);resolve({argv,exitCode:code,signal,error,timedOut,start,end:Date.now(),log,pid:child.pid}); };
    child.once('error',e=>finish(null,null,String(e))); child.once('close',(c,s)=>finish(c,s));
    if(child.pid) onSpawn(child.pid);
  });
}
function sandbox(argv,cwd) { return ['codex','sandbox','-C',cwd,'-c','sandbox_mode="workspace-write"','-c','sandbox_workspace_write.network_access=false','--',...argv]; }
async function checks(cmds,cwd,dir,deadline,label,save) {
  const results=[];
  for(let i=0;i<cmds.length;i++) {
    const r=await command(sandbox(cmds[i],cwd),cwd,path.join(dir,`${label}-${i}.log`),Math.min(deadline,Date.now()+10*60000),pid=>save?.(pid));
    results.push(r); if(r.exitCode!==0||r.timedOut) break;
  }
  return results;
}
export function validChecks(results,expected) { return results?.length===expected&&results.every(r=>r.exitCode===0&&!r.timedOut); }
function candidate(t) {
  if(git(t.worktree,'status','--porcelain')) throw Error('Worker has uncommitted changes');
  const sha=git(t.worktree,'rev-parse','HEAD');
  if(git(t.worktree,'rev-list','--count',`${t.base}..${sha}`)!=='1'||git(t.worktree,'rev-parse',`${sha}^`)!==t.base) throw Error('Require exactly one non-merge worker commit based on assigned base');
  const names=git(t.worktree,'diff-tree','--no-commit-id','--name-only','-r','--no-renames',sha).split('\n').filter(Boolean);
  if(!names.length||names.some(f=>!t.files.some(g=>overlaps(f,g)))) throw Error(`Changes outside reservation: ${names.join(', ')}`);
  const modes=git(t.worktree,'diff-tree','--raw','-r',sha);
  if(/\b(120000|160000)\b/.test(modes)) throw Error('Symlink/submodule changes require manual review');
  return sha;
}
export async function run(opts) {
  const root=path.resolve(opts.root||'.'), common=git(root,'rev-parse','--path-format=absolute','--git-common-dir');
  const dir=opts.dryRun?path.join(root,'.pipeline-dry-run'):path.join(common,'demo-pipeline'), unlock=lock(path.join(dir,'lock'));
  let state,stop=false; const jobs=new Map(), pending=new Map();
  const save=()=>{atomic(path.join(dir,'state.json'),state);report(state,root,dir);};
  const signal=()=>{stop=true; for(const pid of jobs.values())try{process.kill(-pid,'SIGKILL');}catch{}};
  process.on('SIGINT',signal);process.on('SIGTERM',signal);
  try {
    const interactive=path.join(common,'demo-pipeline/interactive.json');
    if(!opts.dryRun&&fs.existsSync(interactive)){const pending=read(interactive);if(pending.tasks.some(t=>['RUNNING','REVIEW','VERIFYING','REPAIR'].includes(t.status))||(pending.externalQueue||[]).some(t=>t.status==='REVIEW'))throw Error('Interactive assignments pending; integrate or reconcile them before CLI dispatch');}
    const backlog=fs.readFileSync(path.join(root,'docs/demo-backlog.md'),'utf8'), manifest=read(path.join(root,opts.manifest||'scripts/pipeline/tasks.json'));
    if(!Number.isFinite(manifest.workerTimeoutMinutes)||manifest.workerTimeoutMinutes<=0||manifest.workerTimeoutMinutes>30) throw Error('workerTimeoutMinutes must be >0 and <=30');
    const digest=hash(backlog+JSON.stringify(manifest));
    if(opts.resume) {
      state=read(path.join(dir,'state.json'));
      if(state.digest!==digest) throw Error('Backlog/metadata changed: review retained state before starting a separate run');
      if(state.mode==='dry-run') throw Error('Dry-run cannot resume as execution');
      if(state.root!==root) throw Error('Resume from original checkout');
      for(const t of state.tasks) if(['RUNNING','VERIFYING','INTEGRATING'].includes(t.status)) {
        // No unsafe automatic lease stealing or replay of an uncertain cherry-pick.
        t.status='INTERRUPTED';t.reason='Inspect logs, worktree and process group; reconcile manually before releasing reservation';
      }
    } else {
      if(fs.existsSync(path.join(dir,'state.json'))&&!opts.dryRun) throw Error('Existing run: use --resume (or archive state manually after reviewing retained worktrees)');
      const now=Date.now();state={version:1,root,digest,mode:opts.dryRun?'dry-run':'running',startedAt:now,deadline:now+opts.duration*60000,tasks:queue(backlog,manifest),runId:String(now)};
    }
    const frozen=()=>Date.now()>=state.deadline-20*60000;
    if(opts.dryRun) { const selected=select(state.tasks,opts.maxWorkers,frozen());state.selected=selected.map(t=>t.id);state.selectionDecisions=state.tasks.filter(t=>['READY','UPCOMING'].includes(t.status)).map(t=>({id:t.id,selected:state.selected.includes(t.id),reason:state.selected.includes(t.id)?'Eligible; exclusive file/interface claim available':'Deferred: dependency, file/interface conflict, freeze or concurrency limit'}));state.nextAction=`Would dispatch: ${state.selected.join(', ')||'none'}; conflicts/dependencies remain queued`;report(state,root,path.join(root,'.pipeline-dry-run')); console.log(JSON.stringify(state,null,2));return; }
    if(Date.now()>=state.deadline) {state.mode='deadline';state.nextAction='Original deadline elapsed; review retained work and archive state before a fresh budget';save();return;}
    if(!state.coordinator) {
      state.coordinator=path.join(dir,`coordinator-${state.runId}`);save();
      git(root,'worktree','add','-b',`codex/pipeline-${state.runId}`,state.coordinator,opts.base);save();
    }
    if(git(state.coordinator,'status','--porcelain')) throw Error('Coordinator dirty/conflicted; inspect and preserve changes before resume');
    // Fail closed before spending tokens if the OS cannot enforce sandboxing.
    const preflight=await checks([[process.execPath,'--version']],state.coordinator,dir,state.deadline,'sandbox-preflight');
    state.lastTests=preflight;save();
    if(!validChecks(preflight,1)) { state.mode='blocked';state.nextAction='Sandbox preflight failed; inspect sandbox-preflight-0.log. No coding agents launched.';save();return; }
    const launch=async t=> {
      t.attempts++;t.status='RUNNING';t.claimedOwner=`${state.runId}/${t.id}/${t.attempts}`;t.startedAt=Date.now();
      t.base=git(state.coordinator,'rev-parse','HEAD');t.worktree=path.join(dir,`${t.id}-${state.runId}-${t.attempts}`);save();
      try {
        git(root,'worktree','add','-b',`codex/pipeline-${state.runId}-${t.id}-${t.attempts}`,t.worktree,t.base);
        const reportFile=path.join(dir,`${t.id}-${t.attempts}-report.txt`), log=path.join(dir,`${t.id}-${t.attempts}-worker.jsonl`);
        const prompt=`Implement approved task ${t.id}: ${t.acceptance}\nRead AGENTS.md and relevant design/plan. Exclusive allowed files/directories: ${JSON.stringify(t.files)}. Shared interface reservations: ${JSON.stringify(t.interfaces||[])}. Do not edit any other file (including docs/implementation-plan.md); coordinator owns reporting. Do not spawn agents, start another pipeline, push, deploy, merge main, use remote services/infrastructure or production data. No new product scope. Run checks ${JSON.stringify([...t.tests,...(t.browserTests||[])])}. Implement and test, then create exactly ONE local non-merge commit. Final report MUST contain commit SHA, actual tests, outcomes, evidence paths and limitations. If task is an audit add a meaningful regression test; do not return a plan. Prior attempt: ${JSON.stringify(t.failure||null)}. Deadline ${new Date(state.deadline).toISOString()}.`;
        const result=await command(['codex','exec','--ignore-user-config','--sandbox','workspace-write','-c','sandbox_workspace_write.network_access=false','-c','approval_policy="never"','-c','features.multi_agent=false','--json','-C',t.worktree,'-o',reportFile,prompt],t.worktree,log,Math.min(state.deadline,Date.now()+manifest.workerTimeoutMinutes*60000),pid=>{t.pid=pid;jobs.set(t.id,pid);save();});
        jobs.delete(t.id);t.workerResult=result;t.reportFile=reportFile;t.finishedAt=Date.now();atomic(path.join(dir,`${t.id}-${t.attempts}-result.json`),{...t,result});save();
        if(result.exitCode!==0||result.timedOut||!fs.existsSync(reportFile)||!fs.readFileSync(reportFile,'utf8').trim()) throw Error('Worker failed, timed out or omitted report');
        t.commit=candidate(t);if(!fs.readFileSync(reportFile,'utf8').includes(t.commit)) throw Error('Final report must include full commit SHA');t.status='PENDING_INTEGRATION';save();
      } catch(e) { jobs.delete(t.id);t.failure=String(e);t.reason=String(e);t.status=t.attempts<2&&!stop&&Date.now()<state.deadline&&!frozen()?'READY':'BLOCKED';t.claimedOwner=null;save(); }
    };
    while(Date.now()<state.deadline&&!stop) {
      if(hash(fs.readFileSync(path.join(root,'docs/demo-backlog.md'),'utf8')+JSON.stringify(read(path.join(root,opts.manifest||'scripts/pipeline/tasks.json'))))!==state.digest) {state.mode='blocked';state.nextAction='Approval source changed; review queue before resuming';stop=true;break;}
      for(const t of state.tasks) if(t.status==='UPCOMING'&&t.dependencies.every(d=>['VERIFIED','BASELINE'].includes(state.tasks.find(x=>x.id===d)?.status))) t.status='READY';
      // Dependency-gated verification and integration are always serialized.
      const t=state.tasks.find(t=>t.status==='PENDING_INTEGRATION');
      if(t) {
        try {if(candidate(t)!==t.commit) throw Error('Candidate SHA changed');} catch(e) {t.status='BLOCKED';t.reason=String(e);t.claimedOwner=null;save();continue;}
        t.status='VERIFYING';save();
        t.testResults=await checks([...t.tests,...(t.browserTests||[])],t.worktree,dir,state.deadline,`${t.id}-${t.attempts}-verify`,pid=>{jobs.set('checks',pid);});jobs.delete('checks');state.lastTests=t.testResults;
        if(!validChecks(t.testResults,t.tests.length+(t.browserTests||[]).length)) {
          t.failure=`Verification failed; retained candidate ${t.commit}, worktree ${t.worktree}`;t.reason=t.failure;t.claimedOwner=null;t.status=t.attempts<2&&!frozen()?'READY':'BLOCKED';save();continue;
        }
        if(Date.now()>=state.deadline||stop) {t.status='PENDING_INTEGRATION';save();break;}
        try {
          if(git(state.coordinator,'status','--porcelain')) throw Error('Coordinator no longer clean');
          t.status='INTEGRATING';t.integrationBase=git(state.coordinator,'rev-parse','HEAD');save();
          git(state.coordinator,'cherry-pick','-x',t.commit);t.integratedCommit=git(state.coordinator,'rev-parse','HEAD');save();
          t.integratedTests=await checks([...t.tests,...(t.browserTests||[])],state.coordinator,dir,state.deadline,`${t.id}-integrated`,pid=>{jobs.set('checks',pid);});jobs.delete('checks');state.lastTests=t.integratedTests;
          if(!validChecks(t.integratedTests,t.tests.length+(t.browserTests||[]).length)) throw Error('Integrated checks failed; preserve coordinator for repair');
          if(git(state.coordinator,'status','--porcelain')) throw Error('Integrated checks left coordinator dirty; inspect retained changes');
          t.status='VERIFIED';t.claimedOwner=null;t.verifiedAt=Date.now();state.lastImprovement=`${t.id}: ${t.acceptance} (${t.integratedCommit}); inspect report ${t.reportFile}`;save();
        } catch(e) { t.status='BLOCKED';t.reason=String(e);state.mode='blocked';state.nextAction='Inspect retained integration candidate/conflicts; no reset or automatic overwrite';stop=true;save(); }
        continue;
      }
      for(const t of select(state.tasks,opts.maxWorkers,frozen())) { const p=launch(t).finally(()=>pending.delete(t.id));pending.set(t.id,p); }
      save();
      if(!pending.size) break;
      await Promise.race([...pending.values(),new Promise(r=>setTimeout(r,250))]);
    }
    if(stop||Date.now()>=state.deadline) signal();
    await Promise.allSettled([...pending.values()]);
    if(!stop&&Date.now()<state.deadline) {state.lastTests=await checks(manifest.regressionTests||[],state.coordinator,dir,state.deadline,'regression',pid=>jobs.set('checks',pid));jobs.delete('checks');if(!validChecks(state.lastTests,(manifest.regressionTests||[]).length)){state.mode='blocked';state.nextAction='Regression checks failed; inspect logs and retained coordinator';}}
    for(const t of state.tasks) if(t.status==='RUNNING') {t.status='INTERRUPTED';t.reason='Deadline/interruption; worktree preserved';}
    if(state.mode!=='blocked') state.mode=Date.now()>=state.deadline?'deadline':stop?'interrupted':'idle';
    state.nextAction=state.mode==='blocked'?state.nextAction:'Review commits, logs, evidence and unfinished tasks. Resume keeps original deadline; no push/deploy performed.';save();
  } finally {signal();await Promise.allSettled([...pending.values()]);process.off('SIGINT',signal);process.off('SIGTERM',signal);unlock();}
}
export function options(args) {
  const o={duration:120,maxWorkers:3,base:'sprint/one-city-two-futures-20261111'};
  for(let i=0;i<args.length;i++) {
    const a=args[i];
    if(a==='--dry-run')o.dryRun=true;else if(a==='--resume')o.resume=true;
    else if(['--duration-minutes','--max-workers','--base','--manifest','--root'].includes(a)) {const v=args[++i];if(!v||v.startsWith('--'))throw Error(`Missing value ${a}`);o[{'--duration-minutes':'duration','--max-workers':'maxWorkers','--base':'base','--manifest':'manifest','--root':'root'}[a]]=v;}
    else throw Error(`Unknown argument ${a}`);
  }
  o.duration=Number(o.duration);o.maxWorkers=Number(o.maxWorkers);
  if(!Number.isFinite(o.duration)||o.duration<=0||o.duration>120||!Number.isInteger(o.maxWorkers)||o.maxWorkers<1||o.maxWorkers>3)throw Error('Duration must be >0 and <=120; workers 1..3');
  return o;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF) run(options(process.argv.slice(2))).catch(e=>{console.error(String(e));process.exitCode=1;});
