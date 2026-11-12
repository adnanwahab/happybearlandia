import {test,expect} from 'bun:test';
import {VERSION,housingProjectBuildingId} from '../world/city/contracts.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {recordedConstructionProgress} from '../world/future-machine/scene/construction-progress.js';
import {createSpatialMapping} from '../world/future-machine/scene/mapping.js';
const snapshot=(projects=[],buildings=[],month=0,version=VERSION)=>({month,state:{month,version,projects,buildings}});
const project=(overrides={})=>({id:'p',type:'housing',stage:'construction',progress:3,duration:12,units:24,...overrides});

test('pure observations preserve actual stages, work and units; identity is not completion',()=>{
 const input=snapshot([project()]);const before=structuredClone(input);Object.freeze(input.state.projects[0]);
 const [row]=recordedConstructionProgress(input);
 expect(row).toMatchObject({id:'p',type:'housing',stage:'construction',progress:3,duration:12,progressRatio:.25,units:24,housingProjectBuildingId:housingProjectBuildingId('p'),buildingPresent:false});
 expect(input).toEqual(before);expect(row).not.toBe(input.state.projects[0]);
 for(const stage of ['proposal','financing','permit','construction','completion','abandoned'])expect(recordedConstructionProgress(snapshot([project({stage})]))[0].stage).toBe(stage);
});
test('missing or invalid measurements remain unavailable; unknown models/types cannot assert building mapping',()=>{
 for(const override of [{progress:null},{progress:NaN},{duration:0},{duration:Infinity},{progress:-1},{progress:13}])expect(recordedConstructionProgress(snapshot([project(override)]))[0].progressRatio).toBe(null);
 expect(recordedConstructionProgress(snapshot([project({units:NaN})]))[0].units).toBe(null);
 expect(recordedConstructionProgress(snapshot([project({type:'utility'})]))[0].housingProjectBuildingId).toBe(null);
 const unsupported=recordedConstructionProgress(snapshot([project()],[],0,'unknown'))[0];expect(unsupported.housingProjectBuildingId).toBe(null);expect(unsupported.buildingPresent).toBe(null);
});
test('completed stage never invents missing building; missing observations fail explicitly',()=>{
 expect(recordedConstructionProgress(snapshot([project({stage:'completion',progress:12})]))[0].buildingPresent).toBe(false);
 expect(recordedConstructionProgress(snapshot([project()], [{id:housingProjectBuildingId('p')}]))[0].buildingPresent).toBe(true);
 expect(recordedConstructionProgress(snapshot())).toEqual([]);
 for(const input of [null,{}, {state:{month:0,projects:[]}}, {...snapshot(),month:1},snapshot([project(),project()])])expect(()=>recordedConstructionProgress(input)).toThrow();
});
test('real fixed-seed project work precedes month16 building, shares schematic slot, and reverses exactly',()=>{
 const initial=initialForRecipe(),engine=createEngine();
 function run(intervention){let state=intervention?addIntervention(initial,intervention):structuredClone(initial);const steps=[];for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});}
 const baseline=run(),plan=run(DEFAULT_RECIPE.intervention),mapping=createSpatialMapping();
 const history=plan.map(s=>recordedConstructionProgress(s));
 expect(history[0]).toEqual([]);
 const stages=[...new Set(history.flat().map(p=>p.stage))];expect(stages).toEqual(['permit','construction','completion']);
 const first=history.findIndex(rows=>rows.some(p=>p.buildingPresent));expect(first).toBe(16);
 const before=history[15][0],after=history[16][0];
 expect(before).toMatchObject({stage:'construction',progress:11,duration:12,units:24,buildingPresent:false});
 expect(after).toMatchObject({stage:'completion',progress:12,progressRatio:1,buildingPresent:true});
 const forward=mapping.frame(baseline[15].state,plan[15].state),completed=mapping.frame(baseline[16].state,plan[16].state);
 const marker=forward.b.find(r=>r.collection==='projects'&&r.id===before.id),building=completed.b.find(r=>r.id===after.housingProjectBuildingId);
 expect(marker.construction).toEqual(before);expect(marker.polygon).toBe(null);expect([marker.x,marker.z]).toEqual([building.x,building.z]);
 expect(forward.b.some(r=>r.id===after.housingProjectBuildingId)).toBe(false);expect(completed.b.some(r=>r.collection==='projects')).toBe(false);
 expect(mapping.frame(baseline[15].state,plan[15].state)).toEqual(forward);
 expect(mapping.frame(baseline[0].state,plan[0].state).b.some(r=>r.collection==='projects'||r.id===building.id)).toBe(false);
 expect(plan[16].metrics.housingUnits-baseline[16].metrics.housingUnits).toBe(24);
 console.log('Recorded construction:',JSON.stringify({stages,month15:before,month16:after}));
});


test('markers never substitute for completed/abandoned structures or invalid progress',()=>{
 for(const override of [{stage:'completion',progress:12},{stage:'abandoned'},{progress:13},{progress:-1},{duration:0}]){
  const s=snapshot([project(override)]).state;
  expect(createSpatialMapping().frame(s,s).b).toEqual([]);
 }
 const s=snapshot([project({type:'utility'})]).state;
 expect(createSpatialMapping().frame(s,s).b).toEqual([]);
});
