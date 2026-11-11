#!/usr/bin/env bun
// Interactive Codex bridge. Uses the same repository-wide lock as the CLI runner.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {atomic,lock,queue,select} from './demo-pipeline.mjs';
const git=(root,...args)=>{const r=spawnSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,encoding:'utf8',timeout:15000});if(r.status!==0)throw Error(r.stderr||`git ${args[0]} failed`);return r.stdout.trim();};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const busy=new Set(['RUNNING','REVIEW','VERIFYING','REPAIR']);
export function coordinate(args,{root=process.cwd(),stateDir,manifestFile}={}) {
 root=fs.realpathSync(root);const common=fs.realpathSync(path.resolve(root,git(root,'rev-parse','--git-common-dir')));
 const dir=stateDir||path.join(common,'demo-pipeline'),file=path.join(dir,'interactive.json');
 const release=lock(path.join(dir,'lock'));
 try {
  const [action,id,owner,detail]=args;
  const metadata=manifestFile||path.join(root,'scripts/pipeline/tasks.json');
  const current=()=>queue(fs.readFileSync(path.join(root,'docs/demo-backlog.md'),'utf8'),read(metadata));
  let state=fs.existsSync(file)?read(file):{schemaVersion:1,baseline:git(root,'rev-parse','HEAD'),branch:git(root,'branch','--show-current'),tasks:current(),events:[]};
  const task=()=>{const t=state.tasks.find(t=>t.id===id);if(!t)throw Error('Unknown task');return t;};
  const save=()=>{state.updatedAt=new Date().toISOString();atomic(file,state);};
  const event=(type,t,extra={})=>state.events.push({type,id:t.id,at:new Date().toISOString(),...extra});
  if(action==='status'||action==='init'||action==='report') {save();const result=snapshot(state);if(action==='report'){const target=path.join(root,'docs/engineering-pipeline-status.md');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,renderReport(result));}return result;}
  if(action==='refresh') {
   const next=current();state.tasks=next.map(t=>{const old=state.tasks.find(o=>o.id===t.id);return old&&(busy.has(old.status)||old.status==='VERIFIED')?old:t;});save();return snapshot(state);
  }
  if(action==='claim') {
   const external=path.join(dir,'state.json');if(fs.existsSync(external)&&read(external).tasks.some(t=>['RUNNING','VERIFYING','PENDING_INTEGRATION','INTEGRATING','INTERRUPTED'].includes(t.status)))throw Error('External runner assignments pending; reconcile before interactive dispatch');
   const t=task();if(!owner||!detail)throw Error('claim requires task owner worktree');
   if(state.tasks.filter(t=>['REVIEW','VERIFYING'].includes(t.status)).length>2)throw Error('Backpressure: integrate pending contributions first');
   // Re-read approval now: stale local READY state cannot override new external ownership.
   const approved=current().find(x=>x.id===id);if(!approved||!['READY','UPCOMING'].includes(approved.status))throw Error('Task is no longer approved/eligible');
   if(!select(state.tasks,3).some(x=>x.id===id))throw Error('Task not eligible: capacity, dependencies or exclusive ownership');
   const worktree=fs.realpathSync(detail);if(worktree===root)throw Error('Isolated worktree required');
   const workerCommon=fs.realpathSync(path.resolve(worktree,git(worktree,'rev-parse','--git-common-dir')));if(workerCommon!==common)throw Error('Worktree must share repository');
   if(git(worktree,'status','--porcelain'))throw Error('Worker worktree must be clean');
   const base=git(root,'rev-parse','HEAD');if(git(worktree,'rev-parse','HEAD')!==base)throw Error('Worker must start at current integration baseline');
   Object.assign(t,{status:'RUNNING',owner,worktree,base,files:approved.files,interfaces:approved.interfaces,tests:approved.tests,browserTests:approved.browserTests,userFacing:approved.userFacing});event('CLAIM',t,{owner,base,worktree});save();return t;
  }
  if(action==='submit') {
   const t=task();if(t.status!=='RUNNING'||t.owner!==owner)throw Error('Only active owner may submit');
   if(!/^[a-f0-9]{40}$/.test(detail||''))throw Error('Full commit SHA required');
   if(git(t.worktree,'status','--porcelain'))throw Error('Worker changes must be committed');
   if(git(t.worktree,'rev-parse','HEAD')!==detail||git(root,'rev-parse',detail+'^')!==t.base)throw Error('Exactly one contribution commit from claimed base required');
   const changed=git(root,'diff','--name-only',t.base,detail).split('\n').filter(Boolean);
   if(!changed.length||changed.some(f=>!t.files.some(p=>f===p||f.startsWith(p.replace(/\/$/,'')+'/'))))throw Error('Contribution violates exclusive file ownership');
   Object.assign(t,{status:'REVIEW',commit:detail,changed});event('SUBMIT',t,{commit:detail});save();return t;
  }
  if(action==='integrate') {
   const t=task();if(t.status!=='REVIEW')throw Error('Reviewed contribution required');
   if(git(root,'branch','--show-current')!==state.branch||['main','master',''].includes(state.branch))throw Error('Integration branch mismatch or release branch');
   if(git(root,'status','--porcelain'))throw Error('Clean integration checkout required');
   if(git(t.worktree,'status','--porcelain')||git(t.worktree,'rev-parse','HEAD')!==t.commit)throw Error('Submitted candidate changed after handoff');
   if(!owner||!detail)throw Error('integrate requires reviewer evidence.json');
   const evidence=read(path.resolve(detail));if(evidence.reviewedBy!==owner||!evidence.notes||!evidence.modelChecks)throw Error('Explicit contract/model review evidence required');
   if(t.userFacing&&(!evidence.screenshots?.length||evidence.screenshots.some(p=>!fs.existsSync(p))))throw Error('Reviewed browser screenshots required');
   t.status='VERIFYING';t.checks=[];save();
   function checks(cwd,phase){for(const argv of [...t.tests,...(t.browserTests||[])]){const r=spawnSync(argv[0],argv.slice(1),{cwd,encoding:'utf8',timeout:600000,maxBuffer:4e6});const result={phase,argv,exitCode:r.status,error:r.error?.message,stdout:r.stdout,stderr:r.stderr};t.checks.push(result);save();if(r.status!==0)throw Error(`${phase} check failed: ${argv.join(' ')}`);}}
   try {checks(t.worktree,'candidate');git(root,'cherry-pick','-x',t.commit);t.integratedCommit=git(root,'rev-parse','HEAD');checks(root,'integrated');t.status='VERIFIED';t.evidence=evidence;state.baseline=t.integratedCommit;event('VERIFIED',t,{integratedCommit:t.integratedCommit,reviewer:owner});save();return t;}
   catch(error){t.status='REPAIR';t.failure=error.message;event('REPAIR',t,{reason:t.failure});save();throw error;}
  }
  throw Error('Commands: init, status, refresh, claim ID OWNER WORKTREE, submit ID OWNER SHA, integrate ID REVIEWER EVIDENCE_JSON');
 } finally {release();}
}
export function snapshot(state){return {baseline:state.baseline,branch:state.branch,ready:select(state.tasks,3).map(t=>t.id),readyPool:state.tasks.filter(t=>['READY','UPCOMING'].includes(t.status)).map(t=>t.id),active:state.tasks.filter(t=>t.status==='RUNNING'),verification:state.tasks.filter(t=>['REVIEW','VERIFYING'].includes(t.status)),blocked:state.tasks.filter(t=>['BLOCKED','REPAIR'].includes(t.status)).map(({id,reason,failure})=>({id,reason,failure})),integrated:state.tasks.filter(t=>t.status==='VERIFIED'),next:state.tasks.filter(t=>['REVIEW','VERIFYING'].includes(t.status)).length>2?'Integrate verification queue':select(state.tasks,1)[0]?.id||'Review blocked tasks'};}
export function renderReport(s){
 const ids=rows=>rows.map(t=>typeof t==='string'?t:`${t.id}${t.owner?' ('+t.owner+')':''}`).join(', ')||'None';
 return `# Engineering pipeline status\n\nAuthoritative branch: ${s.branch}; last accepted baseline: ${s.baseline}.\n\n- READY execution pool: ${ids(s.readyPool)}\n- Dispatchable now (capacity three): ${ids(s.ready)}\n- Active assignments: ${ids(s.active)}\n- Verification queue: ${ids(s.verification)}\n- Blocked/unconfigured: ${ids(s.blocked)}\n- Independently integrated: ${ids(s.integrated)}\n- Test failures: ${s.blocked.filter(t=>t.failure).map(t=>t.id+': '+t.failure).join('; ')||'None recorded'}\n- Next executable action: ${s.next}\n\n## Accepted evidence\n\n${s.integrated.map(t=>'- '+t.id+' → '+t.integratedCommit+'; '+t.checks.length+' independently executed checks; '+t.evidence.notes).join('\n')||'None in this pipeline run.'}\n\nState is durable in the Git common directory under demo-pipeline/interactive.json. The interactive bridge shares the runner lock. Historical backlog VERIFIED is baseline evidence, not a test executed by this run. Tasks lacking reviewed execution metadata stay blocked rather than being dispatched speculatively. No main merge or deployment is implemented.\n`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{console.log(JSON.stringify(coordinate(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
