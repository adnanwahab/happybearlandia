import {test,expect} from 'bun:test';
import {mkdtemp,readFile,rm,mkdir,writeFile,chmod} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {classifyPullRequest,reconcileIntegrationQueue,integrationKey,claimIntegrationRepair,finishIntegrationRepair,validateIntegrationQueue,type PullRequestObservation,type IntegrationSnapshot} from './integration-queue';
import {auditOptions,readIntegrationSnapshot,writeIntegrationAudit} from './audit-integration';
const now='2026-11-17T12:00:00.000Z',sha='a'.repeat(40),sha2='b'.repeat(40),repo='fixture/repo',base='main',policy={requiredChecks:['unit','typecheck'],maxAttempts:2};
const at=(ms:number)=>new Date(Date.parse(now)+ms).toISOString();
function pr(extra:Partial<PullRequestObservation>={}):PullRequestObservation{return {number:1,url:`https://github.com/${repo}/pull/1`,headSha:sha,base,headRepository:repo,author:'author',state:'open',draft:false,mergeable:true,mergeState:'clean',reviewDecision:'APPROVED',labels:[],checks:policy.requiredChecks.map((name,i)=>({id:i+1,name,app:'github-actions',headSha:sha,status:'completed',conclusion:'success',updatedAt:now})),reviews:[{id:1,login:'human',type:'User',state:'APPROVED',commitSha:sha,submittedAt:now,permission:'write'}],legacyState:'pending',legacyTotal:0,observedAt:now,complete:true,...extra};}
const snap=(rows=[pr({mergeable:false,mergeState:'dirty'})]):IntegrationSnapshot=>({repository:repo,base,observedAt:now,complete:true,pullRequests:rows});
const classify=(row:PullRequestObservation)=>classifyPullRequest(row,repo,base,policy,now);
const queue=()=>reconcileIntegrationQueue(null,snap(),policy,now);
const claim=(q=queue(),options={})=>claimIntegrationRepair(q,q.entries[0].key,{owner:'repair-1',leaseId:'lease-1',now,policy,leaseMs:1000,...options});
const finish=(q=claim(),options={})=>finishIntegrationRepair(q,q.entries[0].key,{owner:'repair-1',leaseId:'lease-1',headSha:sha,now:at(100),result:'failed',failureClass:'code',policy,...options} as any);

test('separates conflict, current-head failed/pending/missing CI and positive human review',()=>{
 expect(classify(pr({mergeable:false,mergeState:'dirty'}))).toMatchObject({kind:'conflict',repair:'conflict'});
 const failed=pr();failed.checks[0].conclusion='failure';expect(classify(failed)).toMatchObject({kind:'ci_failed',repair:'ci'});
 failed.mergeState='blocked';expect(classify(failed).kind).toBe('ci_failed');
 const pending=pr();pending.checks[0].status='in_progress';expect(classify(pending).kind).toBe('ci_pending');
 expect(classify(pr({checks:[]})).kind).toBe('ci_missing');expect(classify(pr()).kind).toBe('ready_for_human_merge');
 expect(classify(pr({reviewDecision:null,reviews:[]}))).toMatchObject({kind:'needs_human_review',repair:null});
});
test('old green checks never conceal a newer failed rerun, and wrong head or app cannot pass',()=>{
 const row=pr();row.checks.push({...row.checks[0],id:5,conclusion:'failure',updatedAt:at(1)});expect(classify(row).kind).toBe('ci_failed');
 row.checks[2].updatedAt=now;expect(classify(row).kind).toBe('ci_failed');
 expect(classify(pr({checks:[{...pr().checks[0],headSha:sha2}]})).kind).toBe('ambiguous');
 expect(classify(pr({checks:pr().checks.map(c=>({...c,app:'foreign-app'}))})).kind).toBe('ci_missing');
});
test('missing, stale, bot, read-only, self and changes-requested reviews cannot become ready',()=>{
 for(const patch of [{commitSha:sha2},{type:'Bot'},{permission:'read'},{login:'author'},{permission:undefined},{state:'CHANGES_REQUESTED'}])expect(classify(pr({reviews:[{...pr().reviews[0],...patch}]})).kind).toBe('needs_human_review');
 const comments=pr();comments.reviews.push({...comments.reviews[0],id:2,state:'COMMENTED',submittedAt:at(1)});expect(classify(comments).kind).toBe('ready_for_human_merge');
 const dismissed=pr();dismissed.reviews.push({...dismissed.reviews[0],id:2,state:'DISMISSED',submittedAt:at(1)});expect(classify(dismissed).kind).toBe('needs_human_review');
});
test('scope, policy holds and incomplete/stale data fail closed without repair claims',()=>{
 for(const extra of [{draft:true},{labels:['hold']},{headRepository:'other/repo'},{base:'other'}])expect(classify(pr(extra)).kind).toBe('policy_hold');
 for(const extra of [{complete:false},{observedAt:at(-300001)},{observedAt:at(5001)},{mergeable:null,mergeState:'unknown'}])expect(classify(pr(extra)).kind).toBe('ambiguous');
 for(const row of [pr(),pr({checks:[]}),pr({reviewDecision:null,reviews:[]})]){const q=reconcileIntegrationQueue(null,snap([row]),policy,now);expect(()=>claim(q)).toThrow('not eligible');}
});
test('complete repeated observations are idempotent and preserve attempt and receipt history',()=>{
 const q=queue(),again=reconcileIntegrationQueue(q,snap(),policy,now);expect(again).toEqual(q);expect(q.entries).toHaveLength(1);
 const leased=claim(q);expect(q.entries[0].attempts).toBe(0);expect(leased.entries[0].attempts).toBe(1);expect(()=>claim(leased)).toThrow('already used');
 expect(reconcileIntegrationQueue(leased,snap(),policy,at(500)).entries[0].lease).toEqual(leased.entries[0].lease);
});
test('crashed lease recovery is bounded and stale worker cannot submit after takeover',()=>{
 const expired=reconcileIntegrationQueue(claim(),{...snap(),observedAt:at(1000)},policy,at(1000));expect(expired.entries[0]).toMatchObject({attempts:1,status:'queued'});expect(expired.entries[0].receipts[0].result).toBe('expired');
 const second=claim(expired,{owner:'repair-2',leaseId:'lease-2',now:at(1000)});expect(()=>finish(second)).toThrow('not owned');
 const exhausted=finish(second,{owner:'repair-2',leaseId:'lease-2',now:at(1100)});expect(exhausted.entries[0].status).toBe('exhausted');expect(()=>claim(exhausted)).toThrow('already used');
 expect(()=>finish(claim(),{now:at(1000)})).toThrow('stale');expect(()=>finish(claim(),{now:at(-1)})).toThrow('stale');expect(()=>claim(expired)).toThrow('already used');
});
test('new PR head creates a separate budget and invalidates old lease with durable receipt',()=>{
 const row=pr({headSha:sha2,mergeable:false,mergeState:'dirty'}),q=reconcileIntegrationQueue(claim(),snap([row]),policy,now);
 expect(q.entries).toHaveLength(2);expect(q.entries[0].status).toBe('superseded');expect(q.entries[0].receipts[0].result).toBe('invalidated');expect(q.entries[1]).toMatchObject({attempts:0,status:'queued'});
 expect(()=>finish(q)).toThrow('stale');
 const absent=reconcileIntegrationQueue(claim(),snap([]),policy,now);expect(absent.entries[0].status).toBe('absent');expect(absent.entries[0].receipts[0].owner).toBe('repair-1');
});
test('successful code repair awaits verification; auth/policy/environment failures never auto retry',()=>{
 const success=finish(claim(),{result:'succeeded',failureClass:undefined,evidence:'local test passed, CI pending'});expect(success.entries[0].status).toBe('awaiting_verification');expect(reconcileIntegrationQueue(success,snap(),policy,now).entries[0].status).toBe('awaiting_verification');
 for(const failureClass of ['auth','policy','environment']){const held=finish(claim(),{failureClass});expect(held.entries[0].status).toBe('held');expect(reconcileIntegrationQueue(held,snap(),policy,now).entries[0].status).toBe('held');expect(()=>claim(held)).toThrow('already used');}
});
test('queue rejects partial scans, duplicate identities, wrong scope and malformed persisted budgets',()=>{
 const q=queue();expect(()=>reconcileIntegrationQueue(q,{...snap(),complete:false},policy,now)).toThrow('Complete');expect(()=>reconcileIntegrationQueue(q,{...snap(),observedAt:at(-300001)},policy,now)).toThrow('Fresh');
 expect(()=>reconcileIntegrationQueue(q,{...snap(),repository:'other/repo'},policy,now)).toThrow('another');expect(()=>reconcileIntegrationQueue(q,snap([pr(),pr()]),policy,now)).toThrow('Duplicate');
 q.entries[0].attempts=-1;expect(()=>validateIntegrationQueue(q)).toThrow('Invalid');expect(()=>integrationKey(repo,1,'bad')).toThrow('identity');expect(()=>classifyPullRequest(pr(),repo,base,{requiredChecks:[]},now)).toThrow('checks');
});

function reader({headChange=false,fail=false,incomplete=false,permissionFail=false}={}){
 let pullReads=0;const calls:string[][]=[];
 const read=(args:string[])=>{calls.push(args);if(fail)throw Error('fixture read unavailable');if(args[0]==='pr')return JSON.stringify({reviewDecision:'APPROVED'});const route=args[1];
  if(route.includes('/collaborators/')){if(permissionFail)throw Error('403');return JSON.stringify({permission:'write'});}
  if(route.includes('/check-runs'))return JSON.stringify({total_count:incomplete?3:2,check_runs:pr().checks.map(c=>({...c,head_sha:sha,app:{slug:c.app},completed_at:now}))});
  if(route.includes('/reviews'))return JSON.stringify([{id:1,user:{login:'human',type:'User'},state:'APPROVED',commit_id:sha,submitted_at:now}]);
  if(route.includes('/status?'))return JSON.stringify({sha,statuses:[],state:'pending',total_count:0});
  if(route.includes('/pulls?'))return JSON.stringify([{number:1}]);
  if(route.endsWith('/pulls/1'))return JSON.stringify({number:1,html_url:pr().url,base:{ref:base,sha:'c'.repeat(40),repo:{full_name:repo}},head:{sha:headChange&&++pullReads>1?sha2:sha,repo:{full_name:repo}},user:{login:'author'},state:'open',draft:false,mergeable:true,mergeable_state:'clean',labels:[]});
  throw Error('Unexpected GitHub route '+route);
 };return {read,calls};
}
test('read-only adapter binds head/base, verifies current human permissions and fails on incomplete API',()=>{
 const fixture=reader(),snapshot=readIntegrationSnapshot(fixture.read,{repository:repo,base,now:()=>now});expect(snapshot.pullRequests).toHaveLength(1);expect(classify(snapshot.pullRequests[0]).kind).toBe('ready_for_human_merge');
 expect(fixture.calls.some(args=>args.includes('-X'))).toBe(false);expect(fixture.calls.every(args=>['api','pr'].includes(args[0]))).toBe(true);
 for(const options of [{headChange:true},{fail:true},{incomplete:true}])expect(()=>readIntegrationSnapshot(reader(options).read,{repository:repo,base})).toThrow();
 const unknown=readIntegrationSnapshot(reader({permissionFail:true}).read,{repository:repo,base,now:()=>now});expect(classify(unknown.pullRequests[0]).kind).toBe('needs_human_review');
});
test('CLI requires explicit repository/base and unknown required-check policy',()=>{
 expect(auditOptions(['--repo','adnanwahab/dear_congress','--base','main','--output','/tmp/local.json']).policy.requiredChecks).toHaveLength(3);
 expect(()=>auditOptions(['--repo',repo,'--base',base,'--output','/tmp/local.json'])).toThrow('explicit');expect(()=>auditOptions(['--repo',repo,'--base',base,'--output','/tmp/local.json','--merge','true'])).toThrow('Usage');
 expect(auditOptions(['--repo',repo,'--base',base,'--output','local.json','--required-check','unit']).policy.requiredChecks).toEqual(['unit']);
});
test('atomic durable store survives repeated audit, preserves existing data on failure and respects owner lock',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'mini-integration-')),file=path.join(dir,'queue.json');
 try{
  await writeIntegrationAudit(file,snap(),policy,now);const before=await readFile(file,'utf8');await writeIntegrationAudit(file,snap(),policy,now);expect(await readFile(file,'utf8')).toBe(before);
  await expect(writeIntegrationAudit(file,{...snap(),complete:false},policy,now)).rejects.toThrow();expect(await readFile(file,'utf8')).toBe(before);
  await mkdir(file+'.lock');await expect(writeIntegrationAudit(file,snap(),policy,now)).rejects.toThrow('locked');expect(await readFile(file,'utf8')).toBe(before);await rm(file+'.lock',{recursive:true});
  await writeFile(file,'malformed');await expect(writeIntegrationAudit(file,snap(),policy,now)).rejects.toThrow();expect(await readFile(file,'utf8')).toBe('malformed');
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('normal CLI writes its durable queue using read-only gh calls without touching worker files',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'mini-audit-cli-')),bin=path.join(dir,'bin'),file=path.join(dir,'repair.json');
 try{
  await mkdir(bin);const fixture=reader();readIntegrationSnapshot(fixture.read,{repository:repo,base,now:()=>now});const responses=Object.fromEntries(fixture.calls.map(args=>[JSON.stringify(args),fixture.read(args)]));
  const executable=path.join(bin,'gh'),body='#!'+process.execPath+'\nconst responses='+JSON.stringify(responses)+';const key=JSON.stringify(process.argv.slice(2));if(!(key in responses))throw Error("Unexpected read");console.log(responses[key]);';
  await writeFile(executable,body);await chmod(executable,0o700);
  const result=Bun.spawnSync([process.execPath,'--no-env-file',path.join(import.meta.dir,'audit-integration.ts'),'--repo',repo,'--base',base,'--output',file,'--required-check','unit','--required-check','typecheck'],{cwd:dir,env:{PATH:bin+':'+process.env.PATH,HOME:dir},stdout:'pipe',stderr:'pipe'});
  expect(result.exitCode).toBe(0);const summary=JSON.parse(result.stdout.toString());expect(summary.githubMutations).toBe(0);expect(summary.openPRs).toBe(1);expect(summary.classifications).toEqual({ready_for_human_merge:1});expect(JSON.parse(await readFile(file,'utf8')).entries[0].attempts).toBe(0);
  expect(await Bun.file(path.join(dir,'tasks.json')).exists()).toBe(false);expect(await Bun.file(path.join(dir,'state.json')).exists()).toBe(false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
