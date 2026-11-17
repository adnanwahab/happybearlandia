#!/usr/bin/env bun
/** Read GitHub and atomically maintain an advisory local repair queue. Never mutate GitHub. */
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,rename,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {reconcileIntegrationQueue,type IntegrationSnapshot,type PullRequestObservation,type QueuePolicy} from './integration-queue';
export type ReadCommand=(args:string[])=>string;
const defaults:Record<string,{base:string;checks:string[]}>= {
 'adnanwahab/dear_congress':{base:'main',checks:['bun test','bun run typecheck','route smoke test']},
};
function pageArray(read:ReadCommand,endpoint:string){
 const all:any[]=[];for(let page=1;page<=100;page++){const rows=JSON.parse(read(['api',`${endpoint}${endpoint.includes('?')?'&':'?'}per_page=100&page=${page}`]));if(!Array.isArray(rows))throw Error('Invalid paginated GitHub response');all.push(...rows);if(rows.length<100)return all;}throw Error('GitHub pagination exceeded100pages');
}
export function readIntegrationSnapshot(read:ReadCommand,{repository,base,now=()=>new Date().toISOString()}:{repository:string;base:string;now?:()=>string}):IntegrationSnapshot{
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)||!base||/[\s?#]/.test(base))throw Error('Explicit valid repository and base required');
 const root='repos/'+repository,listed=pageArray(read,`${root}/pulls?state=open&base=${encodeURIComponent(base)}`),seen=new Set<number>(),pullRequests:PullRequestObservation[]=[];
 for(const row of listed){
  if(!Number.isSafeInteger(row.number)||row.number<1||seen.has(row.number))throw Error('Duplicate or invalid PR number');seen.add(row.number);
  const pr=JSON.parse(read(['api',`${root}/pulls/${row.number}`]));
  if(pr.number!==row.number||pr.base?.repo?.full_name?.toLowerCase()!==repository.toLowerCase()||pr.base.ref!==base)throw Error('Cross-repository/base PR response');
  const sha=pr.head?.sha;if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Missing PR head SHA');
  const reviews=pageArray(read,`${root}/pulls/${pr.number}/reviews`);
  const checks:any[]=[];let checkTotal:number|undefined;
  for(let page=1;page<=100;page++){
   const data=JSON.parse(read(['api',`${root}/commits/${sha}/check-runs?filter=all&per_page=100&page=${page}`]));
   if(!Array.isArray(data.check_runs)||!Number.isSafeInteger(data.total_count)||data.total_count<0||checkTotal!==undefined&&checkTotal!==data.total_count)throw Error('Check inventory changed or is incomplete');
   checkTotal=data.total_count;checks.push(...data.check_runs);if(data.check_runs.length<100)break;if(page===100)throw Error('Check pagination exceeded100pages');
  }
  if(checks.length!==checkTotal||new Set(checks.map(c=>c.id)).size!==checks.length)throw Error('Incomplete or duplicate check inventory');
  const status=JSON.parse(read(['api',`${root}/commits/${sha}/status?per_page=100`]));
  if(status.sha!==sha||!Array.isArray(status.statuses)||status.statuses.length!==status.total_count)throw Error('Combined commit-status inventory incomplete');
  const review=JSON.parse(read(['pr','view',String(pr.number),'--repo',repository,'--json','reviewDecision']));
  const permissions=new Map<string,string>();
  for(const reviewer of reviews.filter(r=>r.state==='APPROVED'&&r.commit_id===sha&&r.user?.type==='User')){
   if(permissions.has(reviewer.user.login))continue;
   // Missing permission access cannot become positive maintainer evidence.
   try{const permission=JSON.parse(read(['api',`${root}/collaborators/${encodeURIComponent(reviewer.user.login)}/permission`]));permissions.set(reviewer.user.login,permission.permission??'unknown');}catch{permissions.set(reviewer.user.login,'unknown');}
  }
  const final=JSON.parse(read(['api',`${root}/pulls/${pr.number}`]));
  if(final.head?.sha!==sha||final.base?.sha!==pr.base?.sha||final.base?.ref!==base||final.state!==pr.state)throw Error('PR or integration base changed during audit; rerun');
  pullRequests.push({number:pr.number,url:pr.html_url,headSha:sha,base,headRepository:pr.head.repo?.full_name??'',author:pr.user?.login??'',state:pr.state,draft:pr.draft,mergeable:pr.mergeable,mergeState:pr.mergeable_state,reviewDecision:review.reviewDecision??null,labels:(pr.labels??[]).map((l:any)=>l.name),checks:checks.map(c=>({id:c.id,name:c.name,app:c.app?.slug??'',headSha:c.head_sha,status:c.status,conclusion:c.conclusion,updatedAt:c.completed_at??c.started_at??c.created_at??null})),reviews:reviews.map(r=>({id:r.id,login:r.user?.login??'',type:r.user?.type??'',state:r.state,commitSha:r.commit_id,submittedAt:r.submitted_at,permission:permissions.get(r.user?.login)})),legacyState:status.state,legacyTotal:status.total_count,complete:true,observedAt:now()});
 }
 return {repository,base,observedAt:now(),complete:true,pullRequests};
}
export async function writeIntegrationAudit(file:string,snapshot:IntegrationSnapshot,policy:QueuePolicy,now=snapshot.observedAt){
 const directory=path.dirname(path.resolve(file)),lock=path.resolve(file)+'.lock';await mkdir(directory,{recursive:true});
 try{await mkdir(lock);}catch{throw Error('Integration audit queue locked; preserve its owner and retry later');}
 const temp=path.resolve(file)+'.'+crypto.randomUUID()+'.tmp';
 try{
  await writeFile(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+'\n',{mode:0o600});
  let previous=null;try{previous=JSON.parse(await readFile(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const queue=reconcileIntegrationQueue(previous,snapshot,policy,now);await writeFile(temp,JSON.stringify(queue,null,2)+'\n',{mode:0o600});await rename(temp,file);return queue;
 }finally{await rm(temp,{force:true});await rm(lock,{recursive:true,force:true});}
}
export function auditOptions(args:string[]){
 const values:Record<string,string[]>= {};
 for(let i=0;i<args.length;i++){const key=args[i];if(!['--repo','--base','--output','--required-check'].includes(key)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Usage: bun audit-integration.ts --repo owner/repo --base branch --output local-queue.json --required-check "exact check name" (repeat checks)');(values[key]??=[]).push(args[++i]);}
 for(const key of ['--repo','--base','--output'])if(values[key]?.length!==1)throw Error('Exactly one '+key+' is required');
 const repository=values['--repo'][0].toLowerCase(),base=values['--base'][0],known=defaults[repository];
 const requiredChecks=values['--required-check']??(known?.base===base?known.checks:null);
 if(!requiredChecks?.length)throw Error('Provide explicit --required-check names for this repository/base; do not guess protected-branch requirements');
 return {repository,base,file:values['--output'][0],policy:{requiredChecks,maxAttempts:2} satisfies QueuePolicy};
}
if(import.meta.main){
 try{
  const options=auditOptions(process.argv.slice(2));
  const read:ReadCommand=args=>{const r=spawnSync('gh',args,{encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});if(r.status!==0)throw Error('GitHub read failed; verify gh authentication/network/API access. Prior queue preserved.');return r.stdout;};
  const snapshot=readIntegrationSnapshot(read,options),queue=await writeIntegrationAudit(options.file,snapshot,options.policy);
  const summary:Record<string,number>={};for(const entry of queue.entries.filter(e=>!['absent','superseded'].includes(e.status)))summary[entry.classification.kind]=(summary[entry.classification.kind]??0)+1;
  console.log(JSON.stringify({repository:options.repository,base:options.base,observedAt:snapshot.observedAt,openPRs:snapshot.pullRequests.length,classifications:summary,repairCandidates:queue.entries.filter(e=>e.status==='queued').length,githubMutations:0,queue:options.file},null,2));
 }catch(error){console.error((error as Error).message);process.exitCode=1;}
}
