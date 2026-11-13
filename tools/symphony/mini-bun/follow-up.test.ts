import { test, expect } from 'bun:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { importProjectTasks } from './linear-import';
import { refreshRunningProject } from './refresh';
import { runnable, queueSummary } from './queue';
import type { Project } from './project';
const project:Project={schemaVersion:1,name:'Test',repository:'/fixture',githubRepository:'fixture/dear_congress',linearProjectId:'project-fixture',linearProjectUrl:'https://linear.app/test',baseBranch:'main',dataDirectory:'/unused'};
const issue={id:'SHE-270',title:'Implement missing behavior',description:'Deliver working code',status:'Todo',statusType:'unstarted',blockedBy:[]};
const family=()=>[
 {id:'SHE-270-r10',issueId:issue.id,enabled:false,disabledReason:'superseded',executionInstruction:'Implement and test a working slice.'},
 {id:'SHE-270-r2',issueId:issue.id,enabled:true},
 {id:'SHE-270',issueId:issue.id,enabled:true},
];
test('numeric revision selection survives priority sorting and two successive refreshes without resurrecting old attempts',()=>{
 const state:any={'SHE-270':{status:'pr_created',pullRequestUrl:'merged-report',attempt:1},'SHE-270-r2':{status:'no_changes',attempt:2}};
 const before=structuredClone(state);
 let tasks=family();
 for(let n=0;n<2;n++){
  tasks=importProjectTasks(project,[issue],[],tasks,state).tasks;
  expect(tasks.filter(t=>t.enabled).map(t=>t.id)).toEqual(['SHE-270-r10']);
  expect(queueSummary(tasks,state).runnable).toBe(1);
  expect(tasks[0].prompt).toContain('Implement and test a working slice.');
  expect(state).toEqual(before);
 }
});
test('open follow-up PR suppresses duplicate dispatch and preserves the original merged report receipt',()=>{
 const state:any={'SHE-270':{status:'pr_created',pullRequestUrl:'merged-report'}};
 const result=importProjectTasks(project,[issue],[{state:'OPEN',headRefName:'mini/SHE-270-r10',title:'SHE-270 implementation',url:'open-followup'}],family(),state);
 expect(result.tasks.filter(t=>t.enabled)).toHaveLength(0);
 expect(state['SHE-270'].pullRequestUrl).toBe('merged-report');
 expect(state['SHE-270-r10'].pullRequestUrl).toBe('open-followup');
 expect(queueSummary(result.tasks,state).runnable).toBe(0);
});
test('retry true cannot rerun published attempts, bypass a disabled dependency, or reclaim work in the same session',()=>{
 for(const status of ['pr_created','running','publishing','needs_review','publish_failed']) expect(runnable({id:'x',enabled:true,retry:true},{x:{status}},new Set())).toBe(false);
 for(const status of ['failed','interrupted','no_changes']){
  expect(runnable({id:'x',enabled:true,retry:true},{x:{status}},new Set())).toBe(true);
  expect(runnable({id:'x',enabled:false,retry:true},{x:{status}},new Set())).toBe(false);
  expect(runnable({id:'x',enabled:true,retry:true},{x:{status}},new Set(['x']))).toBe(false);
 }
});
test('live refresh persists latest follow-up holds and releases without replacing state; scan failure retains queue',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'mini-followup-'));
 const config={...project,dataDirectory:dir};
 const state:any={'SHE-270':{status:'pr_created',pullRequestUrl:'merged-report'}};
 try{
  const fixture=family().map(t=>({...t,prompt:'Historical implementation attempt',githubRepository:project.githubRepository,linearProjectId:project.linearProjectId}));
  const tasks=importProjectTasks(config,[issue],[],fixture,state).tasks;
  await writeFile(path.join(dir,'tasks.json'),JSON.stringify(tasks));
  const stateBefore=structuredClone(state);
  await refreshRunningProject(config,state,async()=>({issues:[{...issue,blockedBy:['SHE-271']}],prs:[]}));
  let saved=JSON.parse(await readFile(path.join(dir,'tasks.json'),'utf8'));
  expect(saved.find(t=>t.id==='SHE-270-r10').disabledReason).toBe('dependency');
  await refreshRunningProject(config,state,async()=>({issues:[issue],prs:[]}));
  saved=JSON.parse(await readFile(path.join(dir,'tasks.json'),'utf8'));
  expect(saved.filter(t=>t.enabled).map(t=>t.id)).toEqual(['SHE-270-r10']);
  expect(state).toEqual(stateBefore);
  expect(await Bun.file(path.join(dir,'state.json')).exists()).toBe(false);
  const before=await readFile(path.join(dir,'tasks.json'),'utf8');
  await expect(refreshRunningProject(config,state,async()=>{throw Error('Linear unavailable');})).rejects.toThrow('Linear unavailable');
  expect(await readFile(path.join(dir,'tasks.json'),'utf8')).toBe(before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
