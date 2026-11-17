import {test,expect} from 'bun:test';
import {constructionReceipts} from '../world/future-machine/evidence.js';
test('building WHY finds only recorded completion through selected time with exact model mapping',()=>{
 const state={projects:[{id:'p1',type:'housing',policyId:'policy'}],buildings:[{id:'building-p1'}]};
 const h={baseline:[],plan:[{month:16,state,events:[{id:'16-0',simulationTime:16,eventType:'PROJECT_COMPLETE',payload:{projectId:'p1',units:24}}]}]};
 expect(constructionReceipts(h,{collection:'buildings',id:'building-p1'},15)).toEqual([]);
 expect(constructionReceipts(h,{collection:'buildings',id:'building-other'},120)).toEqual([]);
 expect(constructionReceipts(h,{collection:'buildings',id:'building-p1'},120)[0]).toMatchObject({eventId:'16-0',month:16,policyId:'policy'});
});

test('construction receipts respect arm-scoped event identity when IDs coincide',()=>{
 const snapshot={month:16,state:{projects:[{id:'p',type:'housing',policyId:'policy'}],buildings:[{id:'building-p'}]},events:[{id:'16-0',simulationTime:16,eventType:'PROJECT_COMPLETE',payload:{projectId:'p',units:24}}]};
 const history={baseline:[structuredClone(snapshot)],plan:[structuredClone(snapshot)]};
 const entity={collection:'buildings',id:'building-p'};
 expect(constructionReceipts(history,entity,16).map(row=>row.future)).toEqual(['baseline','plan']);
 for(const arm of ['baseline','plan'])expect(constructionReceipts(history,{...entity,arm},16).map(row=>row.future)).toEqual([arm]);
 expect(constructionReceipts(history,{...entity,arm:'unknown'},16)).toEqual([]);
});
