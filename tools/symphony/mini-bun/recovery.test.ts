import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publishDraft, type Command } from './publication';
import { reconcile } from './reconcile';
import { createTaskWorkspace, resolveTaskWorkspace } from './workspace';

for (const boundary of ['commit', 'push', 'create', 'success', 'advanced-base', 'new-worktree']) test(`publication resumes after ${boundary}`, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mini-recovery-'));
  const repo = path.join(dir, 'repo'), remote = path.join(dir, 'remote.git');
  const real: Command = (bin, args, cwd) => {
    const p = Bun.spawnSync([bin, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
    return { code: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
  };
  const git = (...args: string[]) => { const r = real('git', args, repo); if (r.code) throw Error(r.stderr); return r.stdout.trim(); };
  try {
    real('git', ['init', '--bare', remote], dir);
    real('git', ['init', '-b', 'main', repo], dir);
    git('config', 'user.email', 'fixture@example.com'); git('config', 'user.name', 'Fixture');
    writeFileSync(path.join(repo, 'a'), 'base'); git('add', '.'); git('commit', '-m', 'base');
    git('remote', 'add', 'origin', remote); git('push', '-u', 'origin', 'main'); git('checkout', '-b', 'mini/SHE-1');
    writeFileSync(path.join(repo, 'a'), 'changed');
    let pr: any = null, failed = false, creates = 0;
    const url = 'https://github.com/test/repo/pull/1';
    const command: Command = (bin, args, cwd) => {
      if (bin === 'gh') {
        if (args[0] === 'auth') return { code: 0, stdout: '', stderr: '' };
        if (args[1] === 'list') return { code: 0, stdout: JSON.stringify(pr ? [pr] : []), stderr: '' };
        expect(args).not.toContain('--draft');
        creates++; pr = { url, state: 'OPEN', isDraft: false, headRefOid:git('rev-parse','HEAD'),isCrossRepository:false, headRefName: 'mini/SHE-1', baseRefName: 'main' };
        if (boundary === 'create' && !failed) { failed = true; return { code: 1, stdout: '', stderr: 'lost response' }; }
        return { code: 0, stdout: url, stderr: '' };
      }
      const result = real(bin, args, cwd);
      if (args[0] === boundary && !failed) { failed = true; return { code: 1, stdout: '', stderr: 'interrupted after success' }; }
      return result;
    };
    if (boundary === 'advanced-base' || boundary === 'new-worktree') {
      const stale = git('rev-parse', 'origin/main');
      git('add', '.'); git('commit', '-m', 'already integrated remotely');
      git('push', 'origin', 'HEAD:main');
      git('update-ref', 'refs/remotes/origin/main', stale);
      if (boundary === 'new-worktree') {
        const currentRemote = git('rev-parse', 'HEAD');
        git('checkout', 'main');
        const sourceHead = git('rev-parse', 'HEAD');
        expect(sourceHead).not.toBe(currentRemote);
        const workspace = path.join(dir, 'fresh-task');
        expect(createTaskWorkspace(real, repo, workspace, 'SHE-2', 'main')).toBe(currentRemote);
        expect(real('git', ['rev-parse', 'HEAD'], workspace).stdout.trim()).toBe(currentRemote);
        expect(git('rev-parse', 'HEAD')).toBe(sourceHead);
        return;
      }
      expect(git('rev-list', '--count', 'origin/main..HEAD')).toBe('1');
      expect(() => publishDraft(command, repo, 'SHE-1', 'main', 'title', 'body')).toThrow('produced no changes to publish');
      expect(git('rev-list', '--count', 'origin/main..HEAD')).toBe('0');
      expect(creates).toBe(0);
      return;
    }
    if (boundary !== 'success') expect(() => publishDraft(command, repo, 'SHE-1', 'main', 'title', 'body')).toThrow();
    expect(publishDraft(command, repo, 'SHE-1', 'main', 'title', 'body')).toBe(url);
    expect(git('rev-list', '--count', 'origin/main..HEAD')).toBe('1');
    expect(creates).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('existing nested worktree moves outside the repository without losing edits',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'mini-workspace-move-'));
  const repo=path.join(dir,'repo'),legacyRoot=path.join(repo,'workspaces'),legacy=path.join(legacyRoot,'SHE-77'),external=path.join(dir,'external');
  const real:Command=(bin,args,cwd)=>{const p=Bun.spawnSync([bin,...args],{cwd,stdout:'pipe',stderr:'pipe'});return{code:p.exitCode,stdout:p.stdout.toString(),stderr:p.stderr.toString()};};
  const git=(...args:string[])=>{const r=real('git',args,repo);if(r.code)throw Error(r.stderr);return r.stdout.trim();};
  try{
    mkdirSync(repo);real('git',['init','-b','main',repo],dir);git('config','user.email','fixture@example.com');git('config','user.name','Fixture');
    writeFileSync(path.join(repo,'base.txt'),'base');git('add','.');git('commit','-m','base');
    mkdirSync(legacyRoot);const add=real('git',['worktree','add','-b','mini/SHE-77',legacy,'HEAD'],repo);expect(add.code).toBe(0);
    writeFileSync(path.join(legacy,'uncommitted.txt'),'keep me');
    const moved=resolveTaskWorkspace(real,repo,legacyRoot,external,'SHE-77');
    expect(moved).toBe(path.join(external,'SHE-77'));expect(existsSync(legacy)).toBe(false);
    expect(readFileSync(path.join(moved,'uncommitted.txt'),'utf8')).toBe('keep me');
    expect(real('git',['branch','--show-current'],moved).stdout.trim()).toBe('mini/SHE-77');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('reconciliation holds merged, review and no_changes work and preserves other tasks/state', () => {
  const issue = (id: string, status = 'Backlog') => ({ id, title: 'Implement feature', description: 'Full acceptance criteria', status, url: 'https://linear.app/test' });
  const state = { 'SHE-3': { status: 'no_changes' } };
  const original = JSON.stringify(state);
  const result = reconcile([issue('SHE-1'), issue('SHE-2', 'In Review'), issue('SHE-3'), issue('SHE-4')],
    [{ headRefName: 'mini/SHE-1', state: 'MERGED', url: 'https://github.com/test/repo/pull/1' }],
    [{ id: 'SHE-99', prompt: 'Unrelated task', enabled: true }], state);
  expect(result.report.map(r => r.reason)).toEqual(['merged_acceptance_review', 'review_required', 'no_changes_review_required', 'ready_for_triage']);
  expect(result.tasks[0].enabled).toBe(true);
  expect(result.tasks.slice(1).every(t => !t.enabled)).toBe(true);
  expect(JSON.stringify(state)).toBe(original);
  expect(() => reconcile([{ ...issue('SHE-5'), description: '(truncated, use `get_issue` for full description)' }], [], [], {})).toThrow();
});

test('closed PRs and unreviewed edits cannot be silently published', () => {
  let mutations = 0;
  const command: Command = (bin, args) => {
    if (['push', 'commit', 'add', 'create'].includes(args[0]) || args[1] === 'create') mutations++;
    const stdout = bin === 'git' && args[0] === 'branch' ? 'mini/SHE-1' :
      args[1] === 'list' ? JSON.stringify([{ url: 'https://github.com/test/repo/pull/1', state: 'CLOSED',isDraft:false,headRefOid:'abc',isCrossRepository:false, headRefName: 'mini/SHE-1', baseRefName: 'main' }]) : '';
    return { code: 0, stdout, stderr: '' };
  };
  expect(() => publishDraft(command, '/unused', 'SHE-1', 'main', 'title', 'body')).toThrow('closed without merging');
  expect(mutations).toBe(0);
});

import { runnable, queueSummary } from './queue';
test('idle summary distinguishes enabled from runnable and explicit retries', () => {
  const tasks = [
    { id: 'done', enabled: true, linearStatusType: 'completed' },
    { id: 'new', enabled: false },
    { id: 'old', enabled: true },
    { id: 'retry', enabled: true, retry: true },
  ];
  const state = { old: { status: 'pr_created' }, retry: { status: 'no_changes' } };
  expect(queueSummary(tasks, state)).toEqual({ runnable: 1, disabled: 1, terminal: 1, priorAttempts: 1, running: 0 });
  expect(runnable(tasks[3], state, new Set(['retry']))).toBe(false);
  expect(runnable(tasks[2], state, new Set())).toBe(false);
});

import { approveRemaining } from './approved-queue';
import { miniIssueIdentifier } from '../../../scripts/mini-issue-identifier.mjs';
test('explicit follow-ups preserve history, skip open/active deliveries, disable deleted tasks and are idempotent', () => {
  const issues = [1,2,3,4].map(n => ({ id: `SHE-${n}`, title: 'Work', description: 'Acceptance', status: 'Todo', statusType: 'unstarted', url: 'https://linear.app/test' }));
  const state = { 'SHE-1': { status: 'pr_created' }, 'SHE-2': { status: 'running' }, 'SHE-3': { status: 'pr_created' }, 'SHE-99': { status: 'no_changes' } };
  const tasks = [1,2,3,4,99].map(n => ({ id: `SHE-${n}`, enabled: true }));
  const prs = [{ headRefName: 'mini/SHE-1', state: 'MERGED' }, { headRefName: 'mini/SHE-3', state: 'OPEN' }];
  const original = JSON.stringify(state);
  const result = approveRemaining(issues, prs, tasks, state);
  expect(result.report.map(r => r.action)).toEqual(['follow_up','active','open_pr','enabled']);
  expect(result.tasks.find(t => t.id === 'SHE-1')?.enabled).toBe(false);
  expect(result.tasks.find(t => t.id === 'SHE-1-r2')?.enabled).toBe(true);
  expect(result.tasks.find(t => t.id === 'SHE-99')?.enabled).toBe(false);
  expect(result.tasks.find(t => t.id === 'SHE-4')?.prompt).toContain('docs/reviews/SHE-4.md');
  expect(approveRemaining(issues, prs, result.tasks, state).tasks).toEqual(result.tasks);
  expect(JSON.stringify(state)).toBe(original);
  expect(tasks.every(t => t.enabled)).toBe(true);
});

test('follow-up branch sync maps only exact Mini Symphony branches to original issues', () => {
  expect(miniIssueIdentifier('mini/SHE-137-r2')).toBe('SHE-137');
  expect(miniIssueIdentifier('mini/SHE-137')).toBe('SHE-137');
  for (const branch of ['other/SHE-137-r2','mini/SHE-137-r0','mini/SHE-137-r2-extra','mini/SHE-137-other']) expect(miniIssueIdentifier(branch)).toBeNull();
});

test('activation CLI dry-run leaves queue/state intact and explicit write is repeatable', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mini-activation-'));
  try {
    const tasks = JSON.stringify([{ id: 'SHE-1', enabled: true }, { id: 'SHE-99', enabled: true }]);
    const state = JSON.stringify({ 'SHE-1': { status: 'pr_created' } });
    writeFileSync(path.join(dir, 'tasks.json'), tasks); writeFileSync(path.join(dir, 'state.json'), state);
    writeFileSync(path.join(dir, 'issues.json'), JSON.stringify([{ id: 'SHE-1', title: 'Feature', status: 'Todo', statusType: 'unstarted', description: '## Mini Symphony execution approval — November 12, 2026', labels: ['hbl-agent-ready','hbl-coordinator-approved'] }]));
    writeFileSync(path.join(dir, 'prs.json'), '[]');
    const argv = [process.execPath, path.resolve('tools/symphony/mini-bun/activate-approved.ts'), 'issues.json', '--prs', 'prs.json'];
    const dry = Bun.spawnSync(argv, { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
    expect(dry.exitCode).toBe(0);
    expect(require('node:fs').readFileSync(path.join(dir, 'tasks.json'), 'utf8')).toBe(tasks);
    for (let n = 0; n < 2; n++) expect(Bun.spawnSync([...argv, '--write'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' }).exitCode).toBe(0);
    const saved = JSON.parse(require('node:fs').readFileSync(path.join(dir, 'tasks.json'), 'utf8'));
    expect(saved.filter(t => t.id === 'SHE-1-r2')).toHaveLength(1);
    expect(saved.find(t => t.id === 'SHE-99').enabled).toBe(false);
    expect(require('node:fs').readFileSync(path.join(dir, 'state.json'), 'utf8')).toBe(state);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function existingPublication({draft=true,status='OPEN',dirty=false,remote='abc',local='abc',readyFailure='none'}={}) {
  const calls:string[][]=[];
  const pr:any={url:'https://github.com/test/repo/pull/9',state:status,headRefName:'mini/SHE-9',baseRefName:'main',isDraft:draft,headRefOid:local,isCrossRepository:false};
  let attempts=0;const response:{fresh:any}={fresh:null};
  const command:Command=(bin,args)=>{
    calls.push([bin,...args]);
    const ok=(stdout='')=>({code:0,stdout,stderr:''});
    if(bin==='git') {
      if(args[0]==='branch')return ok('mini/SHE-9');
      if(args[0]==='status')return ok(dirty?' M source.js':'');
      if(args[0]==='ls-remote')return ok(`${remote}\trefs/heads/mini/SHE-9`);
      if(args[0]==='rev-parse')return ok(local);
    }
    if(bin==='gh') {
      if(args[0]==='auth')return ok();
      if(args[1]==='list'){expect(args).toContain('url,state,headRefName,baseRefName,isDraft,headRefOid,isCrossRepository');return ok(JSON.stringify([pr]));}
      if(args[1]==='view')return ok(JSON.stringify(response.fresh??pr));
      if(args[1]==='ready') {
        attempts++;
        if(readyFailure==='before'&&attempts===1)return{code:1,stdout:'',stderr:'not authorized'};
        pr.isDraft=false;
        if(readyFailure==='after'&&attempts===1)return{code:1,stdout:'',stderr:'lost response'};
        return ok(pr.url);
      }
    }
    throw Error(`Unexpected publication command: ${bin} ${args[0]}`);
  };
  return{command,calls,pr,response};
}

for(const draft of [false,true])test(`matching clean existing ${draft?'draft is made ready':'regular PR is reused'} without recreating it`,()=>{
  const fixture=existingPublication({draft}),receipts:any[]=[];
  expect(publishDraft(fixture.command,'/unused','SHE-9','main','title','body',result=>receipts.push(result))).toBe(fixture.pr.url);
  expect(fixture.pr.isDraft).toBe(false);
  expect(fixture.calls.filter(call=>call[1]==='pr'&&call[2]==='ready').length).toBe(draft?1:0);
  expect(fixture.calls.some(call=>call.includes('create')||call.includes('push')||call.includes('merge'))).toBe(false);
  expect(receipts).toEqual([{url:fixture.pr.url,reused:true}]);
});

for(const [name,options,message]of [
 ['dirty',{dirty:true},'additional local edits'],
 ['divergent',{remote:'changed'},'head differs'],
 ['closed',{status:'CLOSED'},'closed without merging'],
]as const)test(`${name} existing draft cannot be made ready`,()=>{
 const fixture=existingPublication(options);
 expect(()=>publishDraft(fixture.command,'/unused','SHE-9','main','title','body')).toThrow(message);
 expect(fixture.calls.some(call=>call.includes('ready'))).toBe(false);
});

test('merged delivery evidence is reused without trying to make it ready',()=>{
 const fixture=existingPublication({status:'MERGED',remote:''});
 expect(publishDraft(fixture.command,'/unused','SHE-9','main','title','body')).toBe(fixture.pr.url);
 expect(fixture.calls.some(call=>call.includes('ready'))).toBe(false);
});

test('unknown open PR draft status fails closed without a publication receipt',()=>{
 const fixture=existingPublication(),receipts:any[]=[];delete fixture.pr.isDraft;
 expect(()=>publishDraft(fixture.command,'/unused','SHE-9','main','title','body',result=>receipts.push(result))).toThrow('draft status is unavailable');
 expect(receipts).toEqual([]);expect(fixture.calls.some(call=>call.includes('ready'))).toBe(false);
});

for(const readyFailure of ['before','after'])test(`ready failure ${readyFailure} mutation stays failed and retries idempotently`,()=>{
 const fixture=existingPublication({readyFailure}),receipts:any[]=[];
 const publish=()=>publishDraft(fixture.command,'/unused','SHE-9','main','title','body',result=>receipts.push(result));
 expect(publish).toThrow(readyFailure==='before'?'not authorized':'lost response');expect(receipts).toEqual([]);
 expect(publish()).toBe(fixture.pr.url);expect(receipts).toEqual([{url:fixture.pr.url,reused:true}]);
 expect(fixture.pr.isDraft).toBe(false);
 expect(fixture.calls.filter(call=>call.includes('ready')).length).toBe(readyFailure==='before'?2:1);
 expect(fixture.calls.some(call=>call.includes('create')||call.includes('merge'))).toBe(false);
});

for(const [label,change]of[
 ['fork',{isCrossRepository:true}],
 ['different PR head',{headRefOid:'different'}],
]as const)test(`${label} cannot be made ready even with a matching origin branch`,()=>{
 const fixture=existingPublication();Object.assign(fixture.pr,change);
 expect(()=>publishDraft(fixture.command,'/unused','SHE-9','main','title','body')).toThrow(label==='fork'?'same-repository':'head differs');
 expect(fixture.calls.some(call=>call.includes('ready'))).toBe(false);
});

for(const change of[{headRefOid:'new-head'},{isCrossRepository:true},{state:'CLOSED'},{baseRefName:'other-base'}])test(`fresh draft identity change remains held: ${JSON.stringify(change)}`,()=>{
 const fixture=existingPublication();fixture.response.fresh={...fixture.pr,...change};
 expect(()=>publishDraft(fixture.command,'/unused','SHE-9','main','title','body')).toThrow('identity or head changed');
 expect(fixture.calls.some(call=>call.includes('ready'))).toBe(false);
});

test('a matching draft made ready elsewhere during recovery is reused idempotently',()=>{
 const fixture=existingPublication();fixture.response.fresh={...fixture.pr,isDraft:false};
 expect(publishDraft(fixture.command,'/unused','SHE-9','main','title','body')).toBe(fixture.pr.url);
 expect(fixture.calls.some(call=>call.includes('ready'))).toBe(false);
});
