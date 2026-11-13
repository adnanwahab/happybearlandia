import {test,expect} from 'bun:test';
import {metricChangeStops} from '../world/future-machine/evidence.js';
import {housingProjectBuildingId} from '../world/city/contracts.js';

const id=housingProjectBuildingId('project-exact');
const event={id:'event-exact',eventType:'PROJECT_COMPLETE',simulationTime:8,payload:{projectId:'project-exact',units:24},modelVersion:'test.v1'};
const snapshot={month:8,state:{projects:[{id:'project-exact',type:'housing',policyId:'policy-exact'}],buildings:[{id}]},events:[event]};
const history={baseline:[],plan:[snapshot]};
const diff={month:120,available:true,metrics:{housingUnits:{delta:24}},entities:[{collection:'buildings',id:'unrelated'},{collection:'buildings',id}]};
test('housing KPI links only exact construction records and preserves historical month and arm',()=>{
 const before=JSON.stringify({history,diff});
 const stops=metricChangeStops(history,diff,'housingUnits');
 expect(stops).toHaveLength(1);
 expect(stops[0].entity).toEqual({collection:'buildings',id,arm:'plan'});
 expect(stops[0].month).toBe(8);
 expect(stops[0].evidence[0].eventId).toBe('event-exact');
 expect(JSON.stringify({history,diff})).toBe(before);
 expect(metricChangeStops(history,{...diff,month:7},'housingUnits')).toEqual([]);
});
test('aggregate, zero, missing, and unsupported links never select a proxy building',()=>{
 for(const key of ['meanRent','capitalSpending','meanTravelMinutes','unknown'])expect(metricChangeStops(history,diff,key)).toEqual([]);
 for(const delta of [0,null,NaN])expect(metricChangeStops(history,{...diff,metrics:{housingUnits:{delta}}},'housingUnits')).toEqual([]);
 expect(metricChangeStops(history,{...diff,available:false},'housingUnits')).toEqual([]);
 expect(metricChangeStops({...history,plan:[{...snapshot,events:[{...event,payload:{projectId:'wrong'}}]}]},diff,'housingUnits')).toEqual([]);
});

test('real matched City pair selects Month 16 receipt from Month 120 KPI',async()=>{
 const {initialForRecipe,normalizeReplay}=await import('../world/future-machine/data/index.js');
 const {createEngine,addIntervention}=await import('../world/city/engine.js');
 const {DEFAULT_RECIPE}=await import('../world/future-machine/contracts.js');
 const {compareHistory}=await import('../world/future-machine/diff/index.js');
 const initial=initialForRecipe();
 const run=policy=>normalizeReplay(initial,createEngine().run(policy?addIntervention(initial,policy):initial,120));
 const h={seed:initial.seed,modelVersion:initial.version,baseline:run(null),plan:run(DEFAULT_RECIPE.intervention)};
 const d=compareHistory(h);
 expect(metricChangeStops(h,d[15],'housingUnits')).toEqual([]);
 const stops=metricChangeStops(h,d[120],'housingUnits');
 expect(stops).toHaveLength(1);
 expect(stops[0]).toMatchObject({month:16,entity:{collection:'buildings',id:'building-project-policy-1-0',arm:'plan'}});
 expect(stops[0].evidence[0]).toMatchObject({eventId:'16-0',payload:{units:24}});
 expect(metricChangeStops(h,d[120],'housingUnits')).toEqual(stops);
});
