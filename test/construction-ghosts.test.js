import {test,expect} from 'bun:test';
import {VERSION} from '../world/city/contracts.js';
import {constructionGhosts} from '../world/future-machine/scene/construction-ghosts.js';
import {createSpatialMapping} from '../world/future-machine/scene/mapping.js';
import {canvasRows} from '../world/future-machine/scene/canvas-stage.js';
const project={id:'p',type:'housing',policyId:'policy',stage:'completion'};
function fixture(){return {plan:[{month:4,state:{version:VERSION,month:4,buildings:[],projects:[project]}},{month:5,state:{version:VERSION,month:5,buildings:[{id:'building-p',floors:3}],projects:[project]},events:[{modelVersion:VERSION,id:'5-0',simulationTime:5,eventType:'PROJECT_COMPLETE',payload:{projectId:'p'}}]}]};}
test('exact next-month event previews without adding current inventory; replay and reverse scrub agree',()=>{
 const history=fixture(),original=JSON.stringify(history),mapping=createSpatialMapping();
 const preview=constructionGhosts(history,4,mapping);
 expect(preview.plan[0]).toMatchObject({id:'building-p',eventId:'5-0',policyId:'policy',projectId:'p',eventMonth:5,ghost:true});
 const state=history.plan[0].state,projection=mapping.frame(state,state);projection.constructionGhosts=preview;
 expect(projection.b).toEqual([]);
 expect(canvasRows(projection,null,'plan').map(r=>[r.id,r.ghost])).toEqual([['building-p',true]]);
 expect(canvasRows(projection,null,'plan','split',false)).toEqual([]);
 expect(constructionGhosts(history,5,mapping).plan).toEqual([]);
 expect(mapping.frame(history.plan[1].state,history.plan[1].state).b[0].id).toBe('building-p');
 expect(constructionGhosts(history,4,mapping)).toEqual(preview);
 expect(JSON.stringify(history)).toBe(original);
});
test('missing observations, unrelated events, wrong time and already present buildings cannot support a preview',()=>{
 for(const change of [h=>h.plan.shift(),h=>h.plan[1].events[0].payload.projectId='other',h=>h.plan[1].events[0].simulationTime=6,h=>h.plan[0].state.buildings.push({id:'building-p'}),h=>h.plan[1].state.projects[0]={...project,policyId:null}]){
 const h=fixture();change(h);expect(constructionGhosts(h,4,createSpatialMapping()).plan).toEqual([]);
 }
});
