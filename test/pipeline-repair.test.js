import {test,expect} from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {coordinate} from '../scripts/pipeline-coordinator.mjs';
const cli=path.resolve('scripts/pipeline-coordinator.mjs');
function git(cwd,...args){const r=spawnSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd,encoding:'utf8'});if(r.status)throw Error(r.stderr);return r.stdout.trim();}
function fixture({integratedFailure=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pipeline-repair-')),root=path.join(dir,'repo'),worker=path.join(dir,'worker');fs.mkdirSync(root);
 git(root,'init','-b','sprint/test');git(root,'config','user.name','Pipeline Test');git(root,'config','user.email','pipeline@example.invalid');
 fs.mkdirSync(path.join(root,'docs'));fs.mkdirSync(path.join(root,'scripts/pipeline'),{recursive:true});
 fs.writeFileSync(path.join(root,'docs/demo-backlog.md'),'| R01 | P0 / S / VERIFIED | existing | none | owner | check |\n| U01 | P1 / S / READY | repair | R01 | worker | check |\n| U02 | P1 / S / READY | overlap | R01 | worker | check |\n');
 const command=integratedFailure?`if(process.cwd()===${JSON.stringify(fs.realpathSync(root))})process.exit(8)`:'process.exit(require("node:fs").readFileSync("test/receipt.txt","utf8").includes("fixed")?0:7)';
 const task={kind:'verification',dependencies:['R01'],files:['test/receipt.txt'],interfaces:['receipt'],userFacing:false,tests:[[process.execPath,'-e',command]],browserTests:[]};
 fs.writeFileSync(path.join(root,'scripts/pipeline/tasks.json'),JSON.stringify({tasks:{U01:task,U02:task}}));git(root,'add','.');git(root,'commit','-m','baseline');git(root,'worktree','add','-b','codex/repair',worker);
 const stateFile=path.join(root,'.git/demo-pipeline/interactive.json'),run=(...args)=>coordinate(args,{root});
 const evidence=path.join(dir,'evidence.json');fs.writeFileSync(evidence,JSON.stringify({reviewedBy:'reviewer',notes:'Reviewed receipt-only change',modelChecks:'No model changes'}));
 run('claim','U01','worker',worker);fs.mkdirSync(path.join(worker,'test'));fs.writeFileSync(path.join(worker,'test/receipt.txt'),'broken');git(worker,'add','.');git(worker,'commit','-m','receipt');const original=git(worker,'rev-parse','HEAD');run('submit','U01','worker',original);
 const state=()=>JSON.parse(fs.readFileSync(stateFile)),taskState=()=>state().tasks.find(t=>t.id==='U01');
 return {dir,root,worker,original,evidence,run,state,taskState,stateFile,amend(content){fs.writeFileSync(path.join(worker,'test/receipt.txt'),content);git(worker,'add','.');git(worker,'commit','--amend','-m','repair receipt');return git(worker,'rev-parse','HEAD');},fail(){expect(()=>run('integrate','U01','reviewer',evidence)).toThrow(integratedFailure?'integrated check failed':'candidate check failed');},cleanup(){fs.rmSync(dir,{recursive:true,force:true});}};
}
test('explicit owner repair succeeds on second attempt and retains failed candidate and logs',()=>{
 const f=fixture();try{
  f.fail();const first=f.taskState();expect(first.attempts).toBe(1);expect(first.checks[0].exitCode).toBe(7);expect(first.failures[0].commit).toBe(f.original);
  expect(()=>f.run('repair','U01','other','reviewed failure')).toThrow('owner');expect(()=>f.run('repair','U01','worker','')).toThrow('reason');
  expect(f.run('status').ready).not.toContain('U02'); // REPAIR retains path/interface reservation.
  f.run('repair','U01','worker','Fix recorded failing receipt');const fixed=f.amend('fixed');f.run('submit','U01','worker',fixed);
  const accepted=f.run('integrate','U01','reviewer',f.evidence);expect(accepted.status).toBe('VERIFIED');expect(accepted.attempts).toBe(2);
  expect(accepted.checks.map(c=>[c.attempt,c.phase,c.exitCode])).toEqual([[1,'candidate',7],[2,'candidate',0],[2,'integrated',0]]);
  expect(accepted.failures[0].checks[0].stderr).toBeDefined();expect(accepted.failures[0].commit).toBe(f.original);expect(accepted.failures[0].evidence.notes).toContain('receipt');expect(git(f.root,'rev-parse','HEAD')).toBe(accepted.integratedCommit);
 }finally{f.cleanup();}
});
test('third attempt is rejected durably, including after refresh, without resetting failed evidence',()=>{
 const f=fixture();try{f.fail();f.run('repair','U01','worker','First and only retry');f.run('submit','U01','worker',f.original);f.fail();f.run('refresh');expect(()=>f.run('repair','U01','worker','Again')).toThrow('two verification attempts');expect(f.taskState().attempts).toBe(2);expect(f.taskState().failures).toHaveLength(2);expect(f.taskState().checks).toHaveLength(2);expect(f.run('status').ready).not.toContain('U02');}finally{f.cleanup();}
});
const child=(root,args)=>new Promise(resolve=>{const c=spawn(process.execPath,[cli,...args],{cwd:root,stdio:'pipe'});let output='';c.stdout.on('data',d=>output+=d);c.stderr.on('data',d=>output+=d);c.on('close',code=>resolve({code,output}));});
test('racing real repair processes authorize exactly one resume and preserve reservations',async()=>{
 const f=fixture();try{f.fail();const results=await Promise.all([child(f.root,['repair','U01','worker','Reviewed fix']),child(f.root,['repair','U01','worker','Reviewed fix'])]);expect(results.filter(r=>r.code===0)).toHaveLength(1);expect(results.filter(r=>r.code!==0)).toHaveLength(1);expect(f.state().events.filter(e=>e.type==='RESUME_REPAIR')).toHaveLength(1);expect(f.taskState().status).toBe('RUNNING');expect(f.taskState().attempts).toBe(1);}finally{f.cleanup();}
});
test('post-integration failure refuses replay and new dispatch until explicit reconciliation',()=>{
 const f=fixture({integratedFailure:true});try{f.fail();const failed=f.taskState();expect(failed.integratedCommit).toBe(git(f.root,'rev-parse','HEAD'));expect(failed.failures[0].checks.map(c=>c.phase)).toEqual(['candidate','integrated']);expect(()=>f.run('repair','U01','worker','Cannot repeat cherry-pick')).toThrow('explicit reconciliation');expect(()=>f.run('claim','U02','second',f.worker)).toThrow('explicit reconciliation');expect(f.run('status').ready).toEqual([]);expect(f.run('status').next).toContain('Reconcile integrated failure');expect(git(f.root,'rev-parse','HEAD')).toBe(failed.integratedCommit);}finally{f.cleanup();}
});

test('legacy full capacity cannot resume a fourth worker',()=>{
 const f=fixture();try{f.fail();const state=f.state();for(let i=0;i<3;i++)state.tasks.push({id:`legacy-${i}`,status:'RUNNING',files:[`legacy${i}`],interfaces:[]});fs.writeFileSync(f.stateFile,JSON.stringify(state));expect(()=>f.run('repair','U01','worker','Reviewed fix')).toThrow('capacity unavailable');expect(f.taskState().status).toBe('REPAIR');expect(f.taskState().attempts).toBe(1);}finally{f.cleanup();}
});
