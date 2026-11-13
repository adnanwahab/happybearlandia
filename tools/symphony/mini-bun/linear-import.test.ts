import {test,expect} from 'bun:test';
import {fetchProjectIssues,importProjectTasks} from './linear-import';
import type {Project} from './project';
const project:Project={schemaVersion:1,name:'Fixture',repository:'/fixture',githubRepository:'fixture/dear_congress',linearProjectId:'36b11054-5397-473e-9e3b-2092a100de5e',linearProjectUrl:'https://linear.app/test',baseBranch:'main',dataDirectory:'/fixture/queue'};
const relation=(id:string,type='blocks',state='unstarted')=>({type,issue:{identifier:id,state:{type:state}}});
const page=(nodes:any[],hasNextPage=false,endCursor:string|null=null)=>({nodes,pageInfo:{hasNextPage,endCursor}});
const node=(id='SHE-1',relations=page([]),type='unstarted')=>({id:'uuid-'+id,identifier:id,title:'Implement',description:'Full acceptance',project:{id:project.linearProjectId},state:{name:'Todo',type},inverseRelations:relations,url:'https://linear.app/test/'+id});
const projectResponse=(nodes:any[],hasNextPage=false,endCursor:string|null=null)=>Response.json({data:{project:{id:project.linearProjectId,issues:page(nodes,hasNextPage,endCursor)}}});
const issueResponse=(id:string,relations:any)=>Response.json({data:{issue:{id:'uuid-'+id,project:{id:project.linearProjectId},inverseRelations:relations}}});

test('active blocker beyond first20relations is fetched and prevents dispatch',async()=>{
 let calls=0;
 const request=async(_url:any,options:any)=>{const body=JSON.parse(options.body);calls++;if(calls===1)return projectResponse([node('SHE-1',page(Array.from({length:20},(_,n)=>relation('SHE-'+(n+10),'related')) ,true,'dep-next'))]);expect(body.variables).toEqual({id:'uuid-SHE-1',after:'dep-next'});return issueResponse('SHE-1',page([relation('SHE-281')]));};
 const issues=await fetchProjectIssues(project,'fixture',request as any);expect(calls).toBe(2);expect(issues[0].blockedBy).toEqual(['SHE-281']);expect(issues[0].dependencyError).toBeNull();expect(importProjectTasks(project,issues,[],[],{}).tasks[0].enabled).toBe(false);
});
test('dependency pages and project pages advance independently; closed blockers do not hold work',async()=>{
 const cursors:any[]=[];
 const request=async(_url:any,options:any)=>{const body=JSON.parse(options.body);cursors.push(body.variables);if(cursors.length===1)return projectResponse([node('SHE-1',page([],true,'dependency-A'))],true,'project-A');if(cursors.length===2)return issueResponse('SHE-1',page([relation('SHE-99','blocks','completed')]));return projectResponse([node('SHE-2')]);};
 const issues=await fetchProjectIssues(project,'fixture',request as any);expect(cursors).toEqual([{id:project.linearProjectId,after:null},{id:'uuid-SHE-1',after:'dependency-A'},{id:project.linearProjectId,after:'project-A'}]);expect(issues.map(i=>i.id)).toEqual(['SHE-1','SHE-2']);expect(importProjectTasks(project,issues,[],[],{}).tasks.every(t=>t.enabled)).toBe(true);
});
for(const failure of ['cycle','missing_cursor','wrong_issue','api_failure'])test(`bad dependency ${failure} holds only its issue, leaving unrelated tasks importable`,async()=>{
 let count=0;
 const request=async()=>{if(++count===1)return projectResponse([node('SHE-1',page([],true,failure==='missing_cursor'?null:'repeat')),node('SHE-2')]);if(failure==='wrong_issue')return issueResponse('SHE-999',page([]));if(failure==='api_failure')return new Response('',{status:503});return issueResponse('SHE-1',page([],true,'repeat'));};
 const issues=await fetchProjectIssues(project,'fixture',request as any);expect(issues[0].dependencyError).toContain('Dependency check incomplete');const result=importProjectTasks(project,issues,[],[],{});expect(result.tasks[0].enabled).toBe(false);expect(result.tasks[0].disabledReason).toBe('dependency');expect(result.tasks[1].enabled).toBe(true);expect(count).toBeLessThanOrEqual(2);
});
test('terminal historical issues do not expand relation pages; a project cursor cycle remains a scan failure',async()=>{
 let calls=0;
 const issues=await fetchProjectIssues(project,'fixture',(async()=>{calls++;return projectResponse([node('SHE-1',page([],true,'unused'),'completed')]);}) as any);expect(calls).toBe(1);expect(issues[0].dependencyError).toBeNull();
 let n=0;await expect(fetchProjectIssues(project,'fixture',(async()=>projectResponse([node('SHE-'+(++n))],true,'same-project-cursor')) as any)).rejects.toThrow('pagination cursor');
});
test('sync-owned holds release when resolved while explicit operator disables/history are preserved',()=>{
 const input=[{id:'SHE-1',title:'Work',description:'Acceptance',status:'Todo',statusType:'unstarted',blockedBy:[]}];
 const state={'SHE-old':{status:'pr_created'}};const before=JSON.stringify(state);
 const blocked=importProjectTasks(project,[{...input[0],blockedBy:['SHE-2']}],[],[],state);expect(blocked.tasks[0].disabledReason).toBe('dependency');
 const released=importProjectTasks(project,input,[],blocked.tasks,state);expect(released.tasks[0].enabled).toBe(true);expect(released.tasks[0].disabledReason).toBeNull();
 const legacy=importProjectTasks(project,input,[],[{id:'SHE-1',enabled:false,blockedBy:['SHE-2']}],state);expect(legacy.tasks[0].enabled).toBe(true);
 const manual=importProjectTasks(project,input,[],[{id:'SHE-1',enabled:false,disabledReason:'operator_disabled'}],state);expect(manual.tasks[0].enabled).toBe(false);expect(JSON.stringify(state)).toBe(before);
});
test('project source prerequisite holds features until its issue is Done, independently of a merged report',()=>{
 const config={...project,prerequisiteIssueIds:['SHE-281']};
 const issues=[{id:'SHE-281',title:'Recover source',description:'Owner task',status:'Todo',statusType:'unstarted'},{id:'SHE-292',title:'Feature',description:'Acceptance',status:'Todo',statusType:'unstarted'}];
 const first=importProjectTasks(config,issues,[],[],{'SHE-281':{status:'pr_created'}});expect(first.tasks[1].enabled).toBe(false);expect(first.tasks[1].holdReason).toContain('SHE-281');
 const next=importProjectTasks(config,[{...issues[0],status:'Done',statusType:'completed'},issues[1]],[],first.tasks,{});expect(next.tasks[1].enabled).toBe(true);
});

test('fresh reviewed follow-up receives live holds and prompt while prior attempt stays superseded',()=>{
 const issue={id:'SHE-1',title:'Implement',description:'Acceptance',status:'Todo',statusType:'unstarted',blockedBy:[]};
 const previous=[{id:'SHE-1',issueId:'SHE-1',enabled:true},{id:'SHE-1-r2',issueId:'SHE-1',enabled:true,executionInstruction:'Implement a bounded working slice.'}];
 const state={'SHE-1':{status:'pr_created',pullRequestUrl:'old'}};
 const first=importProjectTasks(project,[issue],[],previous,state);
 const reordered=importProjectTasks(project,[issue],[],[...previous].reverse(),state);expect(reordered.tasks.find(t=>t.id==='SHE-1-r2').enabled).toBe(true);
 expect(first.tasks[0].enabled).toBe(false);expect(first.tasks[1].enabled).toBe(true);expect(first.tasks[1].prompt).toContain('Implement a bounded working slice.');expect(state['SHE-1'].pullRequestUrl).toBe('old');
 const blocked=importProjectTasks(project,[{...issue,blockedBy:['SHE-2']}],[],first.tasks,state);expect(blocked.tasks[1].enabled).toBe(false);expect(blocked.tasks[1].disabledReason).toBe('dependency');
 const done=importProjectTasks(project,[{...issue,statusType:'completed'}],[],blocked.tasks,state);expect(done.tasks.every(t=>!t.enabled)).toBe(true);
});
