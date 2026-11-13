import type { Project } from './project';
async function linearRequest(token: string, request: typeof fetch, query: string, variables: Record<string,any>) {
  const response=await request('https://api.linear.app/graphql',{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(30000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(`Linear refresh failed: HTTP ${response.status}; ${result.errors?.map(e=>e.message).join('; ')??'request rejected'}`);
  if(result.errors?.length)throw Error('Linear query failed; queue was not changed');
  return result.data;
}
function nextCursor(page: any, seen: Set<string>, label: string) {
  if(typeof page.pageInfo?.hasNextPage!=='boolean')throw Error(`Missing ${label} page information`);
  if(!page.pageInfo.hasNextPage)return null;
  const cursor=page.pageInfo.endCursor;
  if(typeof cursor!=='string'||!cursor||seen.has(cursor))throw Error(`Invalid ${label} pagination cursor`);
  seen.add(cursor);return cursor;
}
export async function fetchProjectIssues(project: Project, token: string, request: typeof fetch = fetch) {
  if(!token)throw Error('LINEAR_API_KEY is required to refresh the board');
  const issues:any[]=[],seenIssues=new Set<string>(),projectCursors=new Set<string>();let after:string|null=null;
  do {
    const data=await linearRequest(token,request,'query($id:String!,$after:String){project(id:$id){id issues(first:20,after:$after){nodes{id identifier title description url priority state{name type} project{id} inverseRelations(first:20){nodes{type issue{identifier state{type}}} pageInfo{hasNextPage endCursor}}} pageInfo{hasNextPage endCursor}}}}',{id:project.linearProjectId,after});
    if(data?.project?.id!==project.linearProjectId)throw Error('Linear refresh returned another project');
    const page=data.project.issues;
    if(!Array.isArray(page?.nodes))throw Error('Invalid Linear issue page');
    for(const issue of page.nodes) {
      if(issue.project?.id!==project.linearProjectId||seenIssues.has(issue.identifier))throw Error('Duplicate or cross-project issue');
      seenIssues.add(issue.identifier);
      const blockedBy=new Set<string>();let dependencyError:string|null=null;
      // Terminal issues never dispatch, so their historical relations need no scan.
      if(!['completed','canceled','duplicate'].includes(issue.state.type)) {
        try {
          let relations=issue.inverseRelations;const cursors=new Set<string>();let pages=0;
          while(true) {
            if(!Array.isArray(relations?.nodes))throw Error('Invalid dependency page');
            for(const relation of relations.nodes) {
              if(relation.type==='blocks') {
                if(!relation.issue?.identifier||!relation.issue.state?.type)throw Error('Invalid blocker record');
                if(!['completed','canceled','duplicate'].includes(relation.issue.state.type))blockedBy.add(relation.issue.identifier);
              }
            }
            const cursor=nextCursor(relations,cursors,'dependency');
            if(cursor===null)break;
            if(++pages>100)throw Error('Dependency scan exceeded100pages');
            if(typeof issue.id!=='string')throw Error('Missing issue ID for dependency pagination');
            const extra=await linearRequest(token,request,'query($id:String!,$after:String){issue(id:$id){id project{id} inverseRelations(first:50,after:$after){nodes{type issue{identifier state{type}}} pageInfo{hasNextPage endCursor}}}}',{id:issue.id,after:cursor});
            if(extra?.issue?.id!==issue.id||extra.issue.project?.id!==project.linearProjectId)throw Error('Dependency issue changed or returned another project');
            relations=extra.issue.inverseRelations;
          }
        } catch(error) {dependencyError=`Dependency check incomplete for ${issue.identifier}: ${String(error instanceof Error?error.message:error)}`;}
      }
      issues.push({id:issue.identifier,title:issue.title,description:issue.description??'',url:issue.url,status:issue.state.name,statusType:issue.state.type,priority:issue.priority,blockedBy:[...blockedBy],dependencyError});
    }
    after=nextCursor(page,projectCursors,'project');
    if(projectCursors.size>1000)throw Error('Project scan exceeded1000pages');
  }while(after!==null);
  return issues;
}
export function importProjectTasks(project: Project, issues: any[], prs: any[], previous: any[], state: Record<string, any>) {
  const tasks = previous.map(t => ({ ...t }));
  const live = new Set(issues.map(i => i.id));
  for (const task of tasks) if (!live.has(task.issueId ?? task.id)) { task.enabled=false;task.disabledReason='source_removed'; }
  for (const issue of issues) {
    const family = tasks.filter(t => (t.issueId ?? t.id) === issue.id);
    const revision = (t:any) => t.id === issue.id ? 1 : Number(t.id.match(/-r([1-9]\d*)$/)?.[1] ?? 0);
    const task = family.reduce((latest:any,t:any)=>!latest||revision(t)>revision(latest)?t:latest,null) ?? { id: issue.id, retry: false };
    for (const old of family) if (old !== task) { old.enabled=false;old.disabledReason='superseded'; }
    const projectBlockers=(project.prerequisiteIssueIds??[]).filter(id=>id!==issue.id&&issues.find(i=>i.id===id)?.statusType!=='completed');
    const wasAutoDisabled=['dependency','existing_pr','terminal','project_hold','project_prerequisite','source_removed','superseded'].includes(task.disabledReason) ||
      (task.enabled===false&&!task.disabledReason&&((task.blockedBy?.length??0)>0||Boolean(task.holdReason)||['completed','canceled','duplicate'].includes(task.linearStatusType)));
    const operatorEnabled=wasAutoDisabled?true:(task.enabled??true);
    const holdReason = project.heldIssues?.[issue.id] ?? issue.dependencyError ?? (projectBlockers.length?`Project source prerequisite not complete: ${projectBlockers.join(', ')}.`:null);
    const terminal = ['completed','canceled','duplicate'].includes(issue.statusType);
    const identity = new RegExp(`(?:^|[^A-Za-z0-9])${issue.id}(?:[^0-9]|$)`, 'i');
    const existing = !terminal && prs.find(p => p.state === 'OPEN' &&
      (identity.test(`${p.headRefName} ${p.title}`) || state[issue.id]?.pullRequestUrl === p.url ||
       (!/[A-Z]+-\d+/i.test(`${p.headRefName} ${p.title}`) && new RegExp(`^Refs?:.*https://linear\\.app/[^/]+/issue/${issue.id}(?:/|$)`, 'im').test(p.body ?? ''))));
    const prompt = `Linear issue ${issue.id}: ${issue.title}\nRepository: ${project.githubRepository}\nBase: ${project.baseBranch}\nStatus: ${issue.status} (${issue.statusType})\nURL: ${issue.url}\n\n${issue.description || 'The issue currently contains only a title. Inspect the existing implementation and tests, record assumptions, and deliver a bounded implementation proposal or verified improvement.'}\n\nWork only in this Dear Congress repository. Read its own instructions, README and relevant module docs; do not apply HappyBearLandia product requirements. Audit current code and existing PRs before changes. Preserve source identities, vote/PR revision isolation and existing data. Run repository tests and typecheck for changed behavior. Save analysis-only results as docs/reviews/${issue.id}.md. A draft PR is a review candidate, not proof of acceptance. Do not deploy, merge, post external messages, change production data, enable live automatic merges, or weaken voting/auth/check requirements. The question about a one-vote quorum is not authorization to enable it. Preserve and document the existing configured merge policy.`;
    const disabledReason=terminal?'terminal':project.heldIssues?.[issue.id]?'project_hold':issue.dependencyError?'dependency':projectBlockers.length?'project_prerequisite':existing?'existing_pr':issue.blockedBy?.length?'dependency':!operatorEnabled?'operator_disabled':null;
    const followUp = task.executionInstruction ? `\n\n${task.executionInstruction}` : '';
    Object.assign(task, { issueId: issue.id, githubRepository: project.githubRepository, linearProjectId: project.linearProjectId, url: issue.url, linearStatus: issue.status, linearStatusType: issue.statusType, blockedBy: issue.blockedBy ?? [], holdReason, dependencyError:issue.dependencyError??null, disabledReason, enabled:disabledReason===null, prompt:prompt+followUp });
    if (!tasks.includes(task)) tasks.push(task);
    if (existing && !['running','publishing'].includes(state[task.id]?.status)) state[task.id] = { ...state[task.id], status: 'pr_created', attempt: state[task.id]?.attempt ?? 0, startedAt: state[task.id]?.startedAt ?? new Date().toISOString(), pullRequestUrl: existing.url, importedExistingPullRequest: true };
  }
  return { tasks, state };
}
