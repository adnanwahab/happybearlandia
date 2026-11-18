import {test,expect} from 'bun:test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {publishDraft,type Command} from './publication';
test('publication excludes screenshot binaries even when the task base does not ignore them',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mini-artifact-publish-')),repo=join(dir,'repo'),remote=join(dir,'remote.git');let pr:any=null,creates=0;
 const real:Command=(bin,args,cwd)=>{const r=Bun.spawnSync([bin,...args],{cwd,stdout:'pipe',stderr:'pipe'});return{code:r.exitCode,stdout:r.stdout.toString(),stderr:r.stderr.toString()};};
 const git=(...args:string[])=>{const r=real('git',args,repo);if(r.code)throw Error(r.stderr);return r.stdout.trim();};
 try{
  real('git',['init','--bare',remote],dir);real('git',['init','-b','main',repo],dir);git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');writeFileSync(join(repo,'source.js'),'base');git('add','.');git('commit','-m','base');git('remote','add','origin',remote);git('push','-u','origin','main');git('checkout','-b','mini/SHE-1');
  mkdirSync(join(repo,'.mini-symphony-evidence'));writeFileSync(join(repo,'.mini-symphony-evidence/capture.png'),'local binary');writeFileSync(join(repo,'source.js'),'changed');writeFileSync(join(repo,'state.json'),'local operator state');writeFileSync(join(repo,'tasks.json'),'local operator queue');
  const command:Command=(bin,args,cwd)=>{if(bin!=='gh')return real(bin,args,cwd);if(args[0]==='auth')return{code:0,stdout:'',stderr:''};if(args[1]==='list')return{code:0,stdout:JSON.stringify(pr?[pr]:[]),stderr:''};creates++;pr={state:'OPEN',isDraft:false,headRefOid:git('rev-parse','HEAD'),isCrossRepository:false,url:'https://github.com/fixture/repo/pull/1',headRefName:'mini/SHE-1',baseRefName:'main'};return{code:0,stdout:pr.url,stderr:''};};
  expect(publishDraft(command,repo,'SHE-1','main','title','body')).toBe('https://github.com/fixture/repo/pull/1');expect(git('show','HEAD:source.js')).toBe('changed');expect(git('ls-tree','--name-only','HEAD','.mini-symphony-evidence/')).toBe('');expect(git('ls-tree','--name-only','HEAD','state.json','tasks.json')).toBe('');
  expect(publishDraft(command,repo,'SHE-1','main','title','body')).toBe(pr.url);expect(creates).toBe(1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
