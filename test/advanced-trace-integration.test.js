import { test,expect } from 'bun:test';
import { createDecisionApiHandler } from '../world/decision/api.js';
import { createMemoryDecisionStore } from '../world/decision/store.js';
import { housingModel,createHousingScenarios } from '../world/models/housing/index.js';
import { createBuildingProposal } from '../world/buildings/proposal.js';
test('summary projection hydrates exact actual monthly/project states without changing immutable full results',async()=>{
 const handler=createDecisionApiHandler({store:createMemoryDecisionStore()});
 const call=async(path='',body)=>{const response=await handler(new Request(`http://local/api/decision-experiments${path}`,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{body:JSON.stringify(body)})}));expect(response.ok).toBe(true);return response.json()};
 try{
  const baseline=createHousingScenarios()[0];baseline.projects=[createBuildingProposal({id:'trace_projection_project',status:'approved',location:{x:0,z:140}})];
  const {experiment}=await call('',{schemaVersion:'decision-experiment.v1',name:'Projection acceptance',decision:'Retain actual recorded construction',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:1,years:10,scenarios:[baseline],metadata:{}});
  await call(`/${experiment.id}/start`,{});
  let result;for(let count=0;count<200;count++){result=await call(`/${experiment.id}/results`);if(result.experiment.status==='completed')break;await Bun.sleep(5)}
  expect(result.experiment.status).toBe('completed');
  const original=JSON.stringify(result),full=result.runs[0];
  expect(full.monthlyTimeline).toHaveLength(121);expect(full.projects[0].states).toHaveLength(121);
  const summary=await call(`/${experiment.id}/results?traces=summary`),row=summary.runs[0];
  expect(summary.traceDelivery).toBe('on-demand');expect(row.monthlyTimeline).toBeUndefined();expect(row.monthlyTimelineCount).toBe(121);
  expect(row.projects[0].states).toEqual([]);expect(row.projects[0].stateCount).toBe(121);
  expect(row.projects[0].finalState).toEqual(full.projects[0].states.at(-1));expect(row.metrics).toEqual(full.metrics);expect(row.sampledParameters).toEqual(full.sampledParameters);
  const traceResponse=await handler(new Request(`http://local${row.traceUrl}`));const {run}=await traceResponse.json();expect(run).toEqual(full);
  expect(JSON.stringify(await call(`/${experiment.id}/results`))).toBe(original);
 }finally{await handler.close()}
});
