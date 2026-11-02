import { expect, test } from 'bun:test';
import { getPinnedDemoInput, getSavedDemoResults, PINNED_DEMO_PROVENANCE } from '../world/decision/demo-fallback.js';
import { resolveHousingModel } from '../world/models/housing/index.js';
import { GUIDED_TOUR_STEPS } from '../world/decision/guided-tour.js';
test('saved fallback is labeled actual model output and exactly reproducible at its pinned version',()=>{
 const input=getPinnedDemoInput(),saved=getSavedDemoResults(),resolved=resolveHousingModel(input.modelVersion);
 expect(saved.readOnly).toBe(true);expect(saved.label).toContain('SAVED MODEL RESULTS');
 expect(PINNED_DEMO_PROVENANCE.seed).toBe(input.seed);expect(saved.runs).toHaveLength(40);
 for(const row of saved.runs){
  const scenario=input.scenarios.find(s=>s.id===row.scenarioId);
  const actual=resolved.simulateRun({parameters:row.sampledParameters,seed:row.seed,years:input.years,projects:scenario.projects||[],scheduledStress:scenario.scheduledStress||[]});
  expect(actual.metrics).toEqual(row.metrics);expect(actual.timeline).toEqual(row.timeline);expect(actual.projects).toEqual(row.projects);
 }
 input.scenarios[0].parameters.initial_rent=99999;
 expect(getPinnedDemoInput().scenarios[0].parameters.initial_rent).not.toBe(99999);
});
test('guided tour is exactly 90 seconds and keeps the signature loop visible',()=>{
 expect(GUIDED_TOUR_STEPS.reduce((sum,step)=>sum+step.seconds,0)).toBe(90);
 const text=GUIDED_TOUR_STEPS.map(step=>step.title).join(' ');
 for(const feature of ['fix','ghost','explain','Fork','better','Stress','evidence'])expect(text.toLowerCase()).toContain(feature.toLowerCase());
});
test('local activity never retains customer or pilot contact fields and is bounded',async()=>{
 const {recordLocalDemoEvent,getLocalDemoActivity}=await import('../world/decision/onboarding.js');
 const records=new Map(),win={localStorage:{getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value)}};
 for(let index=0;index<205;index++)recordLocalDemoEvent('pilot-brief-exported',{organization:'PRIVATE_TEAM',contact:'PRIVATE_EMAIL',runs:10},win);
 expect(getLocalDemoActivity(win)).toHaveLength(200);expect(JSON.stringify([...records.values()])).not.toContain('PRIVATE_');
 expect(recordLocalDemoEvent('unsupported',{prompt:'secret'},win)).toBe(false);
});
