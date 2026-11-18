/** Integration observations and repair leases never grant merge/acceptance authority. */
export type Check = {id:number;name:string;app:string;headSha:string;status:string;conclusion:string|null;updatedAt:string|null};
export type Review = {id:number;login:string;type:string;state:string;commitSha:string;submittedAt:string;permission?:string};
export type PullRequestObservation = {
 number:number;url:string;headSha:string;base:string;headRepository:string;author:string;state:string;draft:boolean;
 mergeable:boolean|null;mergeState:string;reviewDecision:string|null;labels:string[];checks:Check[];reviews:Review[];
 legacyState:string;legacyTotal:number;observedAt:string;complete:boolean;
};
export type IntegrationSnapshot = {repository:string;base:string;observedAt:string;complete:boolean;pullRequests:PullRequestObservation[]};
export type Classification = {kind:'conflict'|'ci_failed'|'ci_pending'|'ci_missing'|'needs_human_review'|'ready_for_human_merge'|'policy_hold'|'ambiguous';reason:string;repair:'conflict'|'ci'|null};
export type RepairReceipt = {leaseId:string;owner:string;headSha:string;startedAt:string;finishedAt:string;result:'succeeded'|'failed'|'expired'|'invalidated';failureClass?:'code'|'auth'|'policy'|'environment';evidence?:string};
export type QueueEntry = {
 key:string;repository:string;base:string;number:number;url:string;headSha:string;firstSeenAt:string;lastSeenAt:string;
 classification:Classification;attempts:number;status:'queued'|'leased'|'held'|'exhausted'|'awaiting_verification'|'superseded'|'absent';
 lease?:{id:string;owner:string;headSha:string;startedAt:string;expiresAt:string};receipts:RepairReceipt[];
};
export type IntegrationQueue = {schemaVersion:1;repository:string;base:string;observedAt:string;entries:QueueEntry[]};
export type QueuePolicy = {requiredChecks:string[];maxAttempts?:number;maxAgeMs?:number};
const repoPattern=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const shaPattern=/^[a-f0-9]{40}$/;
const time=(value:string)=>{const t=Date.parse(value);if(!Number.isFinite(t))throw Error('Invalid observation time');return t;};
function settings(policy:QueuePolicy){
 if(!Array.isArray(policy.requiredChecks)||!policy.requiredChecks.length||policy.requiredChecks.some(s=>typeof s!=='string'||!s.trim())||new Set(policy.requiredChecks).size!==policy.requiredChecks.length)throw Error('Explicit distinct required checks are required');
 const maxAttempts=policy.maxAttempts??2,maxAgeMs=policy.maxAgeMs??300000;
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3||!Number.isInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>900000)throw Error('Invalid repair budget or freshness bound');
 return {maxAttempts,maxAgeMs};
}
export function integrationKey(repository:string,number:number,headSha:string){
 if(!repoPattern.test(repository)||!Number.isSafeInteger(number)||number<1||!shaPattern.test(headSha))throw Error('Invalid PR identity');
 return `${repository.toLowerCase()}#${number}@${headSha}`;
}
export function classifyPullRequest(pr:PullRequestObservation,repository:string,base:string,policy:QueuePolicy,now:string):Classification{
 const {maxAgeMs}=settings(policy);integrationKey(repository,pr.number,pr.headSha);const clock=time(now);
 const result=(kind:Classification['kind'],reason:string,repair:Classification['repair']=null):Classification=>({kind,reason,repair});
 let observed:number;try{observed=time(pr.observedAt);}catch{return result('ambiguous','Invalid observation timestamp');}
 if(!pr.complete||!Number.isInteger(pr.legacyTotal)||pr.legacyTotal<0||clock-observed>maxAgeMs||observed-clock>5000)return result('ambiguous','Incomplete or stale GitHub observation');
 if(pr.state!=='open'||pr.base!==base||pr.draft||pr.headRepository.toLowerCase()!==repository.toLowerCase()||pr.labels.some(l=>['hold','do-not-merge','wip'].includes(l.toLowerCase())))return result('policy_hold','Closed, draft, foreign-repository, wrong-base or explicit hold');
 if(pr.mergeable===false&&pr.mergeState==='dirty')return result('conflict','Branch conflicts with the current integration base','conflict');
 if(pr.mergeable!==true||!['clean','unstable','blocked','behind','has_hooks'].includes(pr.mergeState))return result('ambiguous','Mergeability has not resolved to a supported state');
 if(pr.checks.some(c=>c.headSha!==pr.headSha||!Number.isSafeInteger(c.id)||!c.name||c.updatedAt!==null&&!Number.isFinite(Date.parse(c.updatedAt))))return result('ambiguous','Check identity or head binding is incomplete');
 // GitHub's increasing check-run IDs identify reruns even if an older run finishes later.
 const checks=new Map<string,Check>();for(const check of pr.checks){const key=check.app+'\0'+check.name,old=checks.get(key);if(!old||check.id>old.id)checks.set(key,check);}
 const latest=[...checks.values()],required=policy.requiredChecks.map(name=>checks.get('github-actions\0'+name));
 if(latest.some(c=>c.status==='completed'&&['failure','timed_out','cancelled','action_required','stale','startup_failure'].includes(c.conclusion??''))||pr.legacyTotal>0&&['failure','error'].includes(pr.legacyState))return result('ci_failed','Current-head CI has a failed latest check or commit status','ci');
 if(latest.some(c=>c.status!=='completed')||pr.legacyTotal>0&&pr.legacyState==='pending')return result('ci_pending','Current-head checks or commit statuses are still pending');
 if(required.some(c=>!c||c.conclusion!=='success')||pr.legacyTotal>0&&pr.legacyState!=='success')return result('ci_missing','One or more explicit required GitHub Actions checks are missing or unsuccessful');
 if(latest.some(c=>!['success','neutral','skipped'].includes(c.conclusion??'')))return result('ambiguous','Unrecognized check conclusion');
 const substantive=new Map<string,Review>();
 for(const review of pr.reviews){if(!['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(review.state))continue;const old=substantive.get(review.login);if(!old||Date.parse(review.submittedAt)>Date.parse(old.submittedAt)||review.submittedAt===old.submittedAt&&review.id>old.id)substantive.set(review.login,review);}
 const currentApproval=[...substantive.values()].some(r=>r.state==='APPROVED'&&r.commitSha===pr.headSha&&r.type==='User'&&r.login!==pr.author&&['admin','maintain','write'].includes(r.permission??'')&&Number.isFinite(Date.parse(r.submittedAt)));
 if(pr.reviewDecision!=='APPROVED'||!currentApproval||[...substantive.values()].some(r=>r.state==='CHANGES_REQUESTED'))return result('needs_human_review','Positive current-head human maintainer approval is not independently verified');
 if(pr.mergeState!=='clean')return result('policy_hold','Branch must be current and clean before human integration');
 return result('ready_for_human_merge','Checks and current-head approval observed; protected-branch verification and human merge still required');
}

function invalidateLease(entry:QueueEntry,now:string){
 if(entry.lease){entry.receipts.push({leaseId:entry.lease.id,owner:entry.lease.owner,headSha:entry.lease.headSha,startedAt:entry.lease.startedAt,finishedAt:now,result:'invalidated',evidence:'PR head changed or PR absent from a complete inventory; old worker result is fenced out.'});delete entry.lease;}
}
export function validateIntegrationQueue(queue:IntegrationQueue){
 if(queue?.schemaVersion!==1||!repoPattern.test(queue.repository)||!queue.base||!Array.isArray(queue.entries))throw Error('Invalid durable queue');
 time(queue.observedAt);const keys=new Set<string>();
 for(const entry of queue.entries){
  if(entry.repository!==queue.repository||entry.base!==queue.base||entry.key!==integrationKey(entry.repository,entry.number,entry.headSha)||keys.has(entry.key)||!Number.isInteger(entry.attempts)||entry.attempts<0||entry.attempts>3||!Array.isArray(entry.receipts)||!['queued','leased','held','exhausted','awaiting_verification','superseded','absent'].includes(entry.status))throw Error('Invalid durable repair entry');
  keys.add(entry.key);time(entry.firstSeenAt);time(entry.lastSeenAt);
  if(!entry.classification||!['conflict','ci_failed','ci_pending','ci_missing','needs_human_review','ready_for_human_merge','policy_hold','ambiguous'].includes(entry.classification.kind)||![null,'conflict','ci'].includes(entry.classification.repair))throw Error('Invalid durable classification');
  if(entry.status==='leased'&&!entry.lease||entry.lease&&entry.status!=='leased')throw Error('Invalid lease ownership');
  if(entry.lease){if(entry.lease.headSha!==entry.headSha||!entry.lease.owner||!entry.lease.id||time(entry.lease.expiresAt)<=time(entry.lease.startedAt))throw Error('Invalid lease fence');}
 }
}

export function reconcileIntegrationQueue(previous:IntegrationQueue|null,snapshot:IntegrationSnapshot,policy:QueuePolicy,now:string):IntegrationQueue{
 const {maxAgeMs}=settings(policy),clock=time(now),observed=time(snapshot.observedAt);
 if(clock-observed>maxAgeMs||observed-clock>5000)throw Error('Fresh complete snapshot required; prior queue preserved');
 if(!repoPattern.test(snapshot.repository)||!snapshot.base||!snapshot.complete||!Array.isArray(snapshot.pullRequests))throw Error('Complete repository/base-scoped snapshot required; prior queue preserved');
 if(previous&&(previous.schemaVersion!==1||previous.repository!==snapshot.repository||previous.base!==snapshot.base))throw Error('Integration queue belongs to another repository or base');
 if(previous)validateIntegrationQueue(previous);
 const entries=structuredClone(previous?.entries??[]),byKey=new Map(entries.map(e=>[e.key,e]));if(byKey.size!==entries.length)throw Error('Duplicate durable entry');
 const seen=new Set<string>(),numbers=new Set<number>();
 for(const pr of snapshot.pullRequests){
  const key=integrationKey(snapshot.repository,pr.number,pr.headSha);if(seen.has(key)||numbers.has(pr.number))throw Error('Duplicate PR observation');seen.add(key);numbers.add(pr.number);
  const classification=classifyPullRequest(pr,snapshot.repository,snapshot.base,policy,now);
  let entry=byKey.get(key);
  if(!entry){entry={key,repository:snapshot.repository,base:snapshot.base,number:pr.number,url:pr.url,headSha:pr.headSha,firstSeenAt:now,lastSeenAt:now,classification,attempts:0,status:'held',receipts:[]};entries.push(entry);byKey.set(key,entry);}
  entry.lastSeenAt=now;entry.classification=classification;
  for(const old of entries)if(old.number===entry.number&&old.key!==key){invalidateLease(old,now);old.status='superseded';}
  if(entry.lease&&time(entry.lease.expiresAt)<=time(now)){
   entry.receipts.push({leaseId:entry.lease.id,owner:entry.lease.owner,headSha:entry.lease.headSha,startedAt:entry.lease.startedAt,finishedAt:now,result:'expired'});delete entry.lease;entry.status='queued';
  }
  if(entry.lease)continue;
  if(entry.status==='awaiting_verification')continue;
  // Auth, policy and environment failures require explicit operator intervention.
  const last=entry.receipts.at(-1);if(last?.result==='failed'&&last.failureClass!=='code'){entry.status='held';continue;}
  entry.status=!classification.repair?'held':entry.attempts>=settings(policy).maxAttempts?'exhausted':'queued';
 }
 for(const entry of entries)if(!seen.has(entry.key)&&entry.status!=='superseded'){invalidateLease(entry,now);entry.status=numbers.has(entry.number)?'superseded':'absent';}
 return {schemaVersion:1,repository:snapshot.repository,base:snapshot.base,observedAt:snapshot.observedAt,entries};
}
export function claimIntegrationRepair(queue:IntegrationQueue,key:string,{owner,leaseId,now,leaseMs=1800000,policy}:{owner:string;leaseId:string;now:string;leaseMs?:number;policy:QueuePolicy}):IntegrationQueue{
 validateIntegrationQueue(queue);
 const {maxAttempts,maxAgeMs}=settings(policy),clock=time(now),copy=structuredClone(queue),entry=copy.entries.find(e=>e.key===key);
 if(!owner?.trim()||!leaseId?.trim()||!Number.isInteger(leaseMs)||leaseMs<1000||leaseMs>3600000)throw Error('Invalid repair lease');
 if(copy.entries.some(e=>e.lease?.id===leaseId||e.receipts.some(r=>r.leaseId===leaseId)))throw Error('Repair lease token was already used');
 if(!entry||entry.status!=='queued'||entry.lease||!entry.classification.repair||entry.attempts>=maxAttempts||clock-time(entry.lastSeenAt)>maxAgeMs||time(entry.lastSeenAt)-clock>5000)throw Error('Repair not eligible; refresh exact-head observation first');
 entry.status='leased';entry.attempts++;entry.lease={id:leaseId,owner,headSha:entry.headSha,startedAt:now,expiresAt:new Date(clock+leaseMs).toISOString()};return copy;
}
export function finishIntegrationRepair(queue:IntegrationQueue,key:string,{owner,leaseId,headSha,now,result,failureClass,evidence,policy}:{owner:string;leaseId:string;headSha:string;now:string;result:'succeeded'|'failed';failureClass?:RepairReceipt['failureClass'];evidence?:string;policy:QueuePolicy}):IntegrationQueue{
 validateIntegrationQueue(queue);
 const {maxAttempts}=settings(policy),clock=time(now),copy=structuredClone(queue),entry=copy.entries.find(e=>e.key===key),lease=entry?.lease;
 if(!entry||entry.status!=='leased'||!lease||lease.id!==leaseId||lease.owner!==owner||lease.headSha!==headSha||entry.headSha!==headSha||time(lease.expiresAt)<=clock||clock<time(lease.startedAt))throw Error('Repair result is stale or not owned by this lease');
 if(!['succeeded','failed'].includes(result)||result==='failed'&&!['code','auth','policy','environment'].includes(failureClass??'')||evidence!==undefined&&(typeof evidence!=='string'||evidence.length>4000))throw Error('Invalid repair receipt');
 entry.receipts.push({leaseId,owner,headSha,startedAt:lease.startedAt,finishedAt:now,result,...(failureClass?{failureClass}:{}),...(evidence?{evidence}:{})});delete entry.lease;
 entry.status=result==='succeeded'?'awaiting_verification':failureClass!=='code'?'held':entry.attempts>=maxAttempts?'exhausted':'queued';return copy;
}
