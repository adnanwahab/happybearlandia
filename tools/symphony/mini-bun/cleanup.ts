import path from 'node:path';
import {readdir,lstat} from 'node:fs/promises';
import type {Command} from './publication';
/** Delete worktrees only, never branch refs, task state or logs. Fail closed. */
export async function cleanupMergedWorkspaces(command:Command,repo:string,workspaces:string,prs:any[],activeIds:Set<string>) {
 const report:{id:string;removed:boolean;reason:string}[]=[];
 for(const dir of await readdir(workspaces,{withFileTypes:true}).catch(()=>[])) {
  if(!dir.isDirectory()||dir.isSymbolicLink()||!/^SHE-\d+(?:-r[1-9]\d*)?$/.test(dir.name)||activeIds.has(dir.name))continue;
  const workspace=path.join(workspaces,dir.name);
  if((await lstat(workspace)).isSymbolicLink())continue;
  const run=(args:string[])=>command('git',args,workspace);
  const branch=run(['branch','--show-current']);
  if(branch.code||branch.stdout.trim()!==`mini/${dir.name}`)continue;
  const matches=prs.filter(p=>p.headRefName===branch.stdout.trim());
  if(matches.some(p=>p.state==='OPEN')||!matches.some(p=>p.state==='MERGED'))continue;
  // Confirm ownership and cleanliness again immediately before removal.
  const owner=run(['rev-parse','--git-common-dir']);
  const expected=command('git',['rev-parse','--git-common-dir'],repo);
  if(owner.code||expected.code||path.resolve(workspace,owner.stdout.trim())!==path.resolve(repo,expected.stdout.trim()))continue;
  const status=run(['status','--porcelain','--untracked-files=normal']);
  if(status.code||status.stdout.trim()){report.push({id:dir.name,removed:false,reason:'uncommitted changes'});continue;}
  const result=command('git',['worktree','remove','--force',workspace],repo);
  report.push({id:dir.name,removed:result.code===0,reason:result.code?'git refused removal':'merged PR; branch/history retained'});
 }
 return report;
}
