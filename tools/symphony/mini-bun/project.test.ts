import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { githubIdentity, readProject, validateProjectTasks, projectBinding, validateBinding, workerEnvironment, type Project } from './project';
import { fetchProjectIssues, importProjectTasks } from './linear-import';
const project: Project = { schemaVersion:1,name:'Civic Synthesis',repository:'/fixture/dear_congress',githubRepository:'fixture/dear_congress',linearProjectId:'36b11054-5397-473e-9e3b-2092a100de5e',linearProjectUrl:'https://linear.app/test/project/civic',baseBranch:'main',dataDirectory:'/fixture/queue' };
const issue = (id='SHE-249',statusType='backlog') => ({id,title:'Work',description:'Complete acceptance',url:'https://linear.app/test/issue/'+id,status:'Backlog',statusType});
test('project routing rejects mixed task/state and wrong origin while allowing HTTPS/SSH GitHub identity', () => {
  expect(githubIdentity('https://github.com/adnanwahab/dear_congress.git')).toBe('adnanwahab/dear_congress');
  expect(githubIdentity('git@github.com:adnanwahab/dear_congress.git')).toBe('adnanwahab/dear_congress');
  expect(githubIdentity('https://github.com.attacker.test/adnanwahab/dear_congress')).toBeNull();
  const task={id:'SHE-249',prompt:'Work',githubRepository:project.githubRepository,linearProjectId:project.linearProjectId};
  validateProjectTasks([task],project);
  expect(()=>validateProjectTasks([{...task,githubRepository:'fixture/happybearlandia'}],project)).toThrow('different');
  expect(()=>validateBinding({...projectBinding(project),repository:'/other'},project)).toThrow('different project');
});
test('board import preserves existing Dear Congress PR and enables only unfinished unblocked work', () => {
  const oldState={'SHE-99':{status:'pr_created'}},oldTasks=[{id:'SHE-99',enabled:true}];
  const imported=importProjectTasks(project,[issue(),issue('SHE-251'),issue('SHE-252','completed'),{...issue('SHE-253'),blockedBy:['SHE-249']}],[{headRefName:'codex/she-251-repository-voting',state:'OPEN',url:'https://github.com/fixture/dear_congress/pull/1'}],oldTasks,oldState);
  expect(imported.tasks.find(t=>t.id==='SHE-249').enabled).toBe(true);
  expect(imported.tasks.find(t=>t.id==='SHE-251').enabled).toBe(false);
  expect(imported.state['SHE-251'].pullRequestUrl).toContain('/pull/1');
  expect(imported.tasks.find(t=>t.id==='SHE-252').enabled).toBe(false);
  expect(imported.tasks.find(t=>t.id==='SHE-253').enabled).toBe(false);
  expect(imported.tasks.find(t=>t.id==='SHE-99').enabled).toBe(false);
  expect(oldTasks[0].enabled).toBe(true);
  validateProjectTasks(imported.tasks.filter(t=>t.id!=='SHE-99'),project);
});
test('project-scoped full-description import paginates and rejects cross-project/API failure', async () => {
  let count=0;
  const request=async (_url:any,options:any)=>{
    const body=JSON.parse(options.body);expect(body.variables.id).toBe(project.linearProjectId);expect(body.variables.after).toBe(count===0?null:'next');count++;
    return Response.json({data:{project:{id:project.linearProjectId,issues:{nodes:[{identifier:`SHE-${count}`,title:'Work',description:'Full text',url:'https://linear.app/test',state:{name:'Backlog',type:'backlog'},project:{id:project.linearProjectId},inverseRelations:{nodes:[]}}],pageInfo:{hasNextPage:count===1,endCursor:'next'}}}}});
  };
  expect((await fetchProjectIssues(project,'fixture',request as any)).map(i=>i.id)).toEqual(['SHE-1','SHE-2']);
  await expect(fetchProjectIssues(project,'fixture',(async()=>Response.json({data:{project:{id:'wrong'}}})) as any)).rejects.toThrow();
  await expect(fetchProjectIssues(project,'fixture',(async()=>new Response('',{status:429})) as any)).rejects.toThrow('HTTP 429');
});
for (const mode of ['normal','stubborn','debug-off','debug-pass','debug-blocked','debug-timeout']) test(`configured normal entry ${mode}`, async () => {
  const stubborn=mode==='stubborn',debug=mode.startsWith('debug'),enabled=debug&&mode!=='debug-off';
  const expected=stubborn||mode==='debug-blocked'||mode==='debug-timeout'?'failed':'pr_created';
  const dir=mkdtempSync(path.join(tmpdir(),'mini-project-')),repo=path.join(dir,'dear'),remote=path.join(dir,'remote.git'),queue=path.join(dir,'queue'),bin=path.join(dir,'bin');
  mkdirSync(queue);mkdirSync(bin);
  const realGit=Bun.which('git')!;
  const git=(args:string[],cwd=dir)=>{const r=Bun.spawnSync([realGit,...args],{cwd,stdout:'pipe',stderr:'pipe'});if(r.exitCode)throw Error(r.stderr.toString());return r.stdout.toString().trim();};
  let child: ReturnType<typeof Bun.spawn> | undefined;
  try {
    git(['init','--bare',remote]);git(['init','-b','main',repo]);git(['config','user.email','test@example.test'],repo);git(['config','user.name','Fixture'],repo);
    writeFileSync(path.join(repo,'base.txt'),'base');git(['add','.'],repo);git(['commit','-m','base'],repo);git(['remote','add','origin',remote],repo);git(['push','-u','origin','main'],repo);
    const sourceHead=git(['rev-parse','HEAD'],repo);
    writeFileSync(path.join(repo,'local-uncommitted.txt'),'preserve');
    const profile={...project,repository:repo,dataDirectory:queue};writeFileSync(path.join(queue,'config.json'),JSON.stringify(profile));
    const imported=importProjectTasks(profile,[issue()],[],[],{});writeFileSync(path.join(queue,'tasks.json'),JSON.stringify(imported.tasks));writeFileSync(path.join(queue,'state.json'),'{}');
    const executable=(name:string,text:string)=>{writeFileSync(path.join(bin,name),text);chmodSync(path.join(bin,name),0o755);};
    executable('git',`#!/bin/sh\ncase "$*" in *"remote get-url origin") echo https://github.com/fixture/dear_congress.git;; *) exec '${realGit}' "$@";; esac\n`);
    executable('gh','#!/bin/sh\ncase "$1 $2" in "auth status") exit 0;; "pr list") echo "[]";; "pr create") echo https://github.com/fixture/dear_congress/pull/1;; *) exit 1;; esac\n');
    executable('codex',stubborn?'#!/usr/bin/env bun\nprocess.on("SIGTERM",()=>{});setInterval(()=>{},50);\n':'#!/bin/sh\nprintf "implemented\\n" > implemented.txt\n');
    if(debug)executable('codex',`#!/usr/bin/env bun
const args=process.argv.slice(2), result=args[args.indexOf('--output-last-message')+1];
const countFile=${JSON.stringify(path.join(dir,'calls'))};
const n=Number(await Bun.file(countFile).text().catch(()=> '0'))+1;await Bun.write(countFile,String(n));
if(n===2 && ${JSON.stringify(mode==='debug-timeout')}) {process.on('SIGTERM',()=>{});setInterval(()=>{},50);await new Promise(()=>{});}
await Bun.write('implemented.txt','implemented\\n');
console.log('error: EADDRINUSE');
await Bun.write(result,n===1?'original failure evidence':JSON.stringify({status:${JSON.stringify(mode==='debug-blocked'?'blocked':'passed')},command:'bun test',summary:'fixture validation'}));
`);
    const argv=[process.execPath,path.resolve('tools/symphony/mini-bun/run.ts'),'--config',path.join(queue,'config.json')];
    if(enabled)argv.push('--auto-debug');
    const env={...process.env,PATH:bin+':'+process.env.PATH,CODEX_BIN:path.join(bin,'codex'),MINI_SYMPHONY_WORKERS:'1',MINI_SYMPHONY_TIMEOUT_MS:stubborn||mode==='debug-timeout'?'500':'10000',MINI_SYMPHONY_KILL_GRACE_MS:'100'};
    const check=Bun.spawnSync([...argv,'--check'],{cwd:dir,env,stdout:'pipe',stderr:'pipe'});expect(check.exitCode).toBe(0);expect(JSON.parse(check.stdout.toString()).autoDebug).toBe(enabled);expect(existsSync(path.join(queue,'.runner.lock'))).toBe(false);expect(existsSync(path.join(queue,'workspaces'))).toBe(false);
    child=Bun.spawn(argv,{cwd:dir,env,stdout:'pipe',stderr:'pipe'});
    let state:any;
    for(let n=0;n<100;n++){await Bun.sleep(50);state=JSON.parse(readFileSync(path.join(queue,'state.json'),'utf8'));if(state['SHE-249']?.status===expected)break;}
    expect(state['SHE-249']?.status).toBe(expected);
    if(!stubborn)expect(readFileSync(path.join(queue,'workspaces/SHE-249/implemented.txt'),'utf8')).toBe('implemented\n');
    expect(git(['rev-parse','HEAD'],repo)).toBe(sourceHead);expect(readFileSync(path.join(repo,'local-uncommitted.txt'),'utf8')).toBe('preserve');
    expect(JSON.parse(readFileSync(path.join(queue,'project-binding.json'),'utf8')).githubRepository).toBe(project.githubRepository);
    const duplicate=Bun.spawnSync(argv,{cwd:dir,env,stdout:'pipe',stderr:'pipe'});expect(duplicate.exitCode).toBe(1);expect(duplicate.stderr.toString()).toContain('still owns');
    child.kill('SIGTERM');await child.exited;child=undefined;
    expect(existsSync(path.join(queue,'.runner.lock'))).toBe(false);
    const sessions=readdirSync(path.join(queue,'telemetry/sessions'));expect(sessions).toHaveLength(1);
    const records=readFileSync(path.join(queue,'telemetry/sessions',sessions[0],'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    expect(records[0].type).toBe('session_started');expect(records.at(-1).type).toBe('session_stopped');
    expect(records.filter(e=>e.type==='task_finished')).toHaveLength(1);
    expect(records.some(e=>e.type==='pr_created')).toBe(expected==='pr_created');
    expect(records.some(e=>e.type==='worker_force_stopped')).toBe(stubborn||mode==='debug-timeout');
    if(debug){
      expect(readFileSync(path.join(dir,'calls'),'utf8')).toBe(enabled?'2':'1');
      expect(readFileSync(path.join(queue,'logs/SHE-249.result.md'),'utf8')).toBe('original failure evidence');
      expect(records.filter(e=>e.type==='auto_debug_started')).toHaveLength(enabled?1:0);
      if(enabled)expect(readFileSync(path.join(queue,'telemetry/sessions',sessions[0],'session.log'),'utf8')).toContain(mode==='debug-pass'?'validation passed':'publication held');
    }
    expect(readFileSync(path.join(queue,'telemetry/sessions',sessions[0],'session.log'),'utf8')).toContain('external_SIGTERM');
  } finally {if(child){child.kill('SIGKILL');await child.exited;}rmSync(dir,{recursive:true,force:true});}
},15000);

test('project worker environment excludes application database/bot secrets', () => {
  expect(workerEnvironment({PATH:'/bin',HOME:'/fixture',OPENAI_API_KEY:'fixture-cli-key',DATABASE_URL:'private-db',HBL_COMMENT_TOKEN:'private-bot',LINEAR_API_KEY:'private-tracker'})).toEqual({PATH:'/bin',HOME:'/fixture',OPENAI_API_KEY:'fixture-cli-key'});
});

import { refreshRunningProject } from './refresh';
test('refresh imports new work, holds duplicates/explicit approvals and preserves active state', async () => {
  const dir=mkdtempSync(path.join(tmpdir(),'mini-refresh-'));
  try {
    const config={...project,dataDirectory:dir,heldIssues:{'SHE-280':'Production deploy requires approval','SHE-269':'Parent has child implementations'}};
    const old=importProjectTasks(config,[issue('SHE-251')],[],[],{}).tasks;
    writeFileSync(path.join(dir,'tasks.json'),JSON.stringify(old));
    const state:any={'SHE-251':{status:'running',attempt:1,startedAt:'now'}};
    const result=await refreshRunningProject(config,state,async()=>({issues:[issue('SHE-251'),issue('SHE-270'),issue('SHE-273','duplicate'),issue('SHE-269'),issue('SHE-280')],prs:[{headRefName:'mini/SHE-251',state:'OPEN',url:'https://github.com/fixture/dear_congress/pull/1'}]}));
    expect(result.enabled).toBe(1);
    const saved=JSON.parse(readFileSync(path.join(dir,'tasks.json'),'utf8'));
    expect(saved.find(t=>t.id==='SHE-270').enabled).toBe(true);
    expect(saved.find(t=>t.id==='SHE-273').enabled).toBe(false);
    expect(saved.find(t=>t.id==='SHE-280').holdReason).toContain('approval');
    expect(saved.find(t=>t.id==='SHE-269').enabled).toBe(false);
    expect(state['SHE-251']).toEqual({status:'running',attempt:1,startedAt:'now'});
    expect(existsSync(path.join(dir,'state.json'))).toBe(false);
    const before=readFileSync(path.join(dir,'tasks.json'),'utf8');
    await expect(refreshRunningProject(config,state,async()=>{writeFileSync(path.join(dir,'tasks.json'),before+' ');return {issues:[],prs:[]};})).rejects.toThrow('changed');
    expect(readFileSync(path.join(dir,'tasks.json'),'utf8')).toBe(before+' ');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
