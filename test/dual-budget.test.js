import {test,expect} from 'bun:test';
import {simulationBudget,formatSimulationBudget} from '../world/render/renderer/dual-budget.js';
import {createPopulationRuntime} from '../world/population/runtime.js';
import {readPopulationCheckpoint} from '../world/population/checkpoint.js';
const fixture={modelVersion:'fixture.v1',population:20,metrics:{representedPopulation:1000000},config:{seed:42},runtime:{id:'fixture',revision:1,tick:3,paused:false,diagnostics:{cpuStepEstimateMs:0,completedAt:100,steps:2}}};
test('independent states remain separate from represented totals and visual samples',()=>{
 const before=JSON.stringify(fixture),budget=simulationBudget({...fixture,visibleAgents:[{id:'one'}]},125);
 expect(budget.residentStates).toBe(20);expect(budget.representedResidents).toBe(1000000);expect(budget.cpuStepEstimateMs).toBe(0);expect(budget.sampleAgeMs).toBe(25);expect(budget.interactionsPerSecond).toBeNull();expect(budget.memoryBytes).toBeNull();expect(JSON.stringify(fixture)).toBe(before);
 expect(formatSimulationBudget(budget)).toContain('CPU estimate 0.00 ms');
});
test('missing, invalid, paused and reset data never turn into measurements',()=>{
 expect(simulationBudget(null)).toBeNull();expect(formatSimulationBudget(null)).toContain('unavailable');
 const budget=simulationBudget({...fixture,population:NaN,runtime:{...fixture.runtime,paused:true,diagnostics:null}});
 expect(budget.cpuStepEstimateMs).toBeNull();expect(budget.residentStates).toBeNull();expect(formatSimulationBudget(budget)).toContain('paused');
 expect(simulationBudget(fixture,99).sampleAgeMs).toBeNull();
});
test('runtime estimates manual batches, clears reset samples, excludes timing from model checkpoint',async()=>{
 const runtime=createPopulationRuntime({config:{population:20,seed:42},stepMinutes:1});
 try{await runtime.ready;expect(runtime.getSnapshot().runtime.diagnostics).toBeNull();await runtime.step({steps:2});const snapshot=runtime.getSnapshot();expect(snapshot.runtime.diagnostics.steps).toBe(2);expect(snapshot.runtime.diagnostics.cpuStepEstimateMs).toBeGreaterThanOrEqual(0);
 const checkpoint=readPopulationCheckpoint(await runtime.exportCheckpoint());expect(checkpoint.runtime.diagnostics).toBeUndefined();expect(checkpoint.model.diagnostics).toBeUndefined();
 await runtime.updateConfig({population:20,seed:42});expect(runtime.getSnapshot().runtime.diagnostics).toBeNull();
 }finally{runtime.destroy();}
});

test('seed matched continuation stays exact while visual controls and diagnostics are exercised',async()=>{
 const {QualityManager}=await import('../world/render/renderer/quality-manager.js');
 const {BuildingCutaway}=await import('../world/render/buildings/cutaway.js');
 const THREE=await import('three');
 const a=createPopulationRuntime({config:{population:20,seed:42},stepMinutes:1}),b=createPopulationRuntime({config:{population:20,seed:42},stepMinutes:1});
 const visual=new BuildingCutaway(new THREE.Scene()),quality=new QualityManager();
 const hash=async r=>new Bun.CryptoHasher('sha256').update(JSON.stringify(readPopulationCheckpoint(await r.exportCheckpoint()).model)).digest('hex');
 try{await Promise.all([a.ready,b.ready]);for(let tick=0;tick<3;tick++){
  await a.step();await b.step();const before=await hash(a);
  quality.setPreset(tick%2?'ULTRA':'LOW');quality.sample(25,null,4);visual.enabled=!visual.enabled;visual.update(tick*1000);
  formatSimulationBudget(simulationBudget(a.getSnapshot()));expect(await hash(a)).toBe(before);expect(await hash(b)).toBe(before);
 }}finally{a.destroy();b.destroy();visual.dispose();}
});
