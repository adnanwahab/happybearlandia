import { test, expect } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomic, lock, parseBacklog, queue, overlaps, select, options, command, validChecks, run } from '../scripts/demo-pipeline.mjs';
const row=(id,status='READY',deps='')=>`| ${id} | P1 / S / ${status} | approved acceptance | ${deps} | owner | checks |`;
const meta=(extra={})=>({kind:'feature',files:['src/a.js'],dependencies:[],tests:[['bun','test','test/a.js']],...extra});
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'hbl-pipeline-'));
test('backlog is authority; reject invented tasks, missing dependencies/checks and unsafe reservations',()=>{
 const b=row('U01','UPCOMING','R01')+'\n'+row('R01','VERIFIED');
 expect(()=>queue(b,{tasks:{X01:meta()}})).toThrow('no approved');
 expect(()=>queue(b,{tasks:{U01:meta()}})).toThrow('Missing source');
 expect(()=>queue(b,{tasks:{U01:meta({dependencies:['R01'],files:['../secret']})}})).toThrow('reservation');
 expect(()=>queue(b,{tasks:{U01:meta({dependencies:['R01'],userFacing:true})}})).toThrow('checks');
 const q=queue(b,{tasks:{U01:meta({dependencies:['R01']})}});
 expect(select(q,3).map(t=>t.id)).toEqual(['U01']);
 expect(q.find(t=>t.id==='R01').status).toBe('BASELINE');
 expect(queue(row('U01','RUNNING'),{tasks:{U01:meta()}})[0].status).toBe('BLOCKED');
});
test('selection honors directory, shared interface, active reservation, priority, dependency and capacity',()=>{
 const task=(id,files,extra={})=>({id,files,status:'READY',dependencies:[],priority:'P1',...extra});
 const tasks=[task('U01',['scene']),task('U02',['scene/a.js']),task('U03',['other'],{interfaces:['camera']}),task('U04',['four'],{interfaces:['camera']}),task('U05',['five'],{dependencies:['U01']})];
 expect(select(tasks,3).map(t=>t.id)).toEqual(['U01','U03']);
 tasks[0].status='PENDING_INTEGRATION';
 expect(select(tasks,3).map(t=>t.id)).toEqual(['U03']);
 tasks[0].status='VERIFIED';
 expect(select(tasks,1).map(t=>t.id)).toEqual(['U02']);
 expect(overlaps('a/b','a/bc')).toBe(false);
 expect(overlaps('a/','a/b')).toBe(true);
});
test('freeze stops feature dispatch and permits approved verification only',()=>{
 const t={id:'U01',priority:'P0',status:'READY',files:['a'],dependencies:[]};
 expect(select([t],3,true)).toEqual([]);
 expect(select([{...t,kind:'verification'}],3,true)).toHaveLength(1);
});
test('atomic claims are exclusive and state survives reopen',()=>{
 const dir=tmp(), file=path.join(dir,'state.json'), release=lock(path.join(dir,'lock'));
 try {expect(()=>lock(path.join(dir,'lock'))).toThrow('lock exists');atomic(file,{attempts:2,status:'RUNNING'});expect(JSON.parse(fs.readFileSync(file))).toEqual({attempts:2,status:'RUNNING'});}finally{release();fs.rmSync(dir,{recursive:true});}
});
test('invalid limits/unknown flags cannot launch unbounded workers',()=>{
 expect(options([])).toMatchObject({duration:120,maxWorkers:3});
 for(const args of [['--max-workers','4'],['--duration-minutes','Infinity'],['--duration-minutes','121'],['--duration-minutes','0'],['--yolo'],['--base']])expect(()=>options(args)).toThrow();
});
test('process errors, exits, logs and deadlines are recorded',async()=>{
 const dir=tmp();try{
 const r=await command([process.execPath,'-e','console.log("actual evidence");process.exit(7)'],dir,path.join(dir,'fail.log'),Date.now()+3000);
 expect(r.exitCode).toBe(7);expect(fs.readFileSync(r.log,'utf8')).toContain('actual evidence');
 const timeout=await command([process.execPath,'-e','setInterval(()=>{},1000)'],dir,path.join(dir,'timeout.log'),Date.now()+100);
 expect(timeout.timedOut).toBe(true);expect(validChecks([timeout],1)).toBe(false);
 const missing=await command(['/no/such/program'],dir,path.join(dir,'missing.log'),Date.now()+1000);expect(missing.error).toBeTruthy();
 expect(validChecks([{exitCode:0}],2)).toBe(false);
 }finally{fs.rmSync(dir,{recursive:true});}
});
test('real backlog dry run selects only explicitly executable approved work',async()=>{
 const b=fs.readFileSync('docs/demo-backlog.md','utf8'),m=JSON.parse(fs.readFileSync('scripts/pipeline/tasks.json'));
 const q=queue(b,m),picked=select(q,3);
 // The real approved queue evolves as work is verified or blocked. Assert its
 // execution contract instead of requiring an already-completed dispatch batch.
 expect(picked.length).toBeGreaterThan(0);expect(picked.length).toBeLessThanOrEqual(3);
 for(const task of picked){
  expect(m.tasks[task.id]).toBeDefined();expect(['READY','UPCOMING']).toContain(task.status);
  expect(task.files.length).toBeGreaterThan(0);expect(task.tests.length).toBeGreaterThan(0);
  for(const dependency of task.dependencies)expect(['BASELINE','VERIFIED']).toContain(q.find(row=>row.id===dependency)?.status);
 }
 expect(q.filter(t=>['READY','UPCOMING'].includes(t.status)).length).toBeGreaterThanOrEqual(picked.length);
 expect(q.some(t=>t.status==='BLOCKED')).toBe(true);
 expect(parseBacklog(b).length).toBeGreaterThan(30);
});

// A fake CLI exercises real Git worktrees/commits and scheduling, never a coding model.
import { spawnSync } from 'node:child_process';
function fixture(fail=false) {
 const dir=tmp(),root=path.join(dir,'repo'),bin=path.join(dir,'bin');fs.mkdirSync(root);fs.mkdirSync(bin);fs.mkdirSync(path.join(root,'docs'));
 const g=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
 g('init');g('config','user.email','fixture@example.invalid');g('config','user.name','Pipeline fixture');
 fs.writeFileSync(path.join(root,'docs/demo-backlog.md'),row('U01')+'\n'+row('U02','UPCOMING','U01'));
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({workerTimeoutMinutes:1,tasks:{U01:meta({files:['one.txt'],kind:'verification',tests:[[process.execPath,'-e',fail?'process.exit(1)':'console.log("passed")']]}),U02:meta({files:['two.txt'],kind:'verification',dependencies:['U01'],tests:[[process.execPath,'-e','console.log("passed")']]})},regressionTests:[[process.execPath,'-e','console.log("regression")']]}));
 g('add','.');g('commit','-m','fixture baseline');
 const fake=path.join(bin,'fake.mjs');
 fs.writeFileSync(fake,`import fs from 'node:fs';import {spawnSync} from 'node:child_process';const a=process.argv.slice(2);if(a[0]==='sandbox'){const i=a.indexOf('--');const r=spawnSync(a[i+1],a.slice(i+2),{stdio:'inherit'});process.exit(r.status??1);}const cwd=a[a.indexOf('-C')+1], prompt=a.at(-1), name=prompt.includes('task U01:')?'one.txt':'two.txt';fs.writeFileSync(cwd+'/'+name,'implemented regression fixture');const g=(...args)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};g('add',name);g('commit','-m','fixture implementation');fs.writeFileSync(a[a.indexOf('-o')+1],g('rev-parse','HEAD')+' actual fixture checks');`);
 fs.writeFileSync(path.join(bin,'codex'),`#!/bin/sh\nexec '${process.execPath}' '${fake}' "$@"\n`,{mode:0o755});
 return {dir,root,bin,g};
}
test('end-to-end: actual isolated commits, promotion, verification and ordered local integration',async()=>{
 const f=fixture(),old=process.env.PATH;process.env.PATH=f.bin+':'+old;
 try {
 await run({root:f.root,manifest:'manifest.json',base:'HEAD',duration:1,maxWorkers:3});
 const s=JSON.parse(fs.readFileSync(path.join(f.root,'.git/demo-pipeline/state.json')));
 expect(s.tasks.map(t=>t.status)).toEqual(['VERIFIED','VERIFIED']);expect(s.tasks.every(t=>t.commit&&t.integratedCommit&&validChecks(t.integratedTests,1))).toBe(true);
 expect(s.tasks[1].base).toBe(s.tasks[0].integratedCommit);expect(f.g('rev-list','--count','HEAD')).toBe('1');
 expect(fs.readFileSync(path.join(s.coordinator,'two.txt'),'utf8')).toContain('implemented');
 expect(fs.existsSync(s.tasks[0].worktree)).toBe(true);
 await run({root:f.root,manifest:'manifest.json',resume:true,duration:1,maxWorkers:3});
 expect(JSON.parse(fs.readFileSync(path.join(f.root,'.git/demo-pipeline/state.json'))).tasks[0].attempts).toBe(1);
 }finally{process.env.PATH=old;fs.rmSync(f.dir,{recursive:true});}
}, 30000);
test('failed verification retries once, blocks dependent work and preserves both worker branches',async()=>{
 const f=fixture(true),old=process.env.PATH;process.env.PATH=f.bin+':'+old;
 try {
 await run({root:f.root,manifest:'manifest.json',base:'HEAD',duration:21,maxWorkers:3});
 const s=JSON.parse(fs.readFileSync(path.join(f.root,'.git/demo-pipeline/state.json')));
 expect(s.tasks[0].status).toBe('BLOCKED');expect(s.tasks[0].attempts).toBe(2);expect(s.tasks[1].attempts).toBe(0);
 expect(f.g('branch','--list','codex/*').split('\n')).toHaveLength(3);
 expect(s.tasks[0].testResults[0].exitCode).toBe(1);expect(s.tasks[0].integratedCommit).toBeUndefined();
 }finally{process.env.PATH=old;fs.rmSync(f.dir,{recursive:true});}
}, 30000);
test('interrupted leases remain reserved on resume and original deadline is preserved',async()=>{
 const f=fixture(),old=process.env.PATH;process.env.PATH=f.bin+':'+old;
 try {
 await run({root:f.root,manifest:'manifest.json',base:'HEAD',duration:1,maxWorkers:3});
 const file=path.join(f.root,'.git/demo-pipeline/state.json'),s=JSON.parse(fs.readFileSync(file)),deadline=s.deadline;
 s.tasks[0].status='RUNNING';s.tasks[0].claimedOwner='uncertain-process';s.tasks[1].status='UPCOMING';s.tasks[1].attempts=0;atomic(file,s);
 await run({root:f.root,manifest:'manifest.json',resume:true,duration:120,maxWorkers:3});
 const resumed=JSON.parse(fs.readFileSync(file));expect(resumed.deadline).toBe(deadline);expect(resumed.tasks[0].status).toBe('INTERRUPTED');expect(resumed.tasks[0].claimedOwner).toBe('uncertain-process');expect(resumed.tasks[1].attempts).toBe(0);
 }finally{process.env.PATH=old;fs.rmSync(f.dir,{recursive:true});}
},30000);
test('dry-run demonstrates conflicting reservations without creating workers or integration branches',async()=>{
 const f=fixture();try{
 fs.writeFileSync(path.join(f.root,'docs/demo-backlog.md'),row('U01')+'\n'+row('U02'));
 fs.writeFileSync(path.join(f.root,'manifest.json'),JSON.stringify({workerTimeoutMinutes:1,tasks:{U01:meta(),U02:meta()}}));
 // Suppress the deliberately verbose machine preview in this test only.
 const log=console.log;console.log=()=>{};
 try{await run({root:f.root,manifest:'manifest.json',base:'HEAD',duration:120,maxWorkers:3,dryRun:true});}finally{console.log=log;}
 const s=JSON.parse(fs.readFileSync(path.join(f.root,'docs/pipeline-status.json')));
 expect(s.selected).toEqual(['U01']);expect(s.selectionDecisions[1].selected).toBe(false);expect(f.g('branch','--list','codex/*')).toBe('');expect(fs.existsSync(path.join(f.root,'.git/demo-pipeline'))).toBe(false);
 }finally{fs.rmSync(f.dir,{recursive:true});}
},30000);
