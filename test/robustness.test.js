import { describe, expect, test } from 'bun:test';
import { buildRobustnessExperiment, summarizeRobustnessCell, scoreRobustness } from '../world/decision/robustness.js';
import { housingModel, createHousingScenarios } from '../world/models/housing/index.js';
import { executeDecisionExperiment } from '../world/decision/kernel.js';
import { simulateHousingRun, applyStressPresets } from '../world/models/housing/index.js';
const source = () => ({ schemaVersion:'decision-experiment.v1',name:'Robustness acceptance',decision:'Compare housing plans',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:500,years:10,scenarios:createHousingScenarios(),metadata:{} });
const criterion = { metricId:'affordability',operator:'gte',value:60 };
describe('actual plan × stress robustness',()=>{
  test('builds immutable paired runner inputs and labels preview retention',()=>{
    const input=source(),before=JSON.stringify(input);
    const control=buildRobustnessExperiment({input,planIds:['plan-a','plan-b'],stressId:'control',runs:10,criterion});
    const recession=buildRobustnessExperiment({input,planIds:['plan-a','plan-b'],stressId:'recession',runs:10,criterion});
    expect(JSON.stringify(input)).toBe(before);
    expect(control.scenarios.map(s=>s.id)).toEqual(['baseline','plan-a','plan-b']);
    expect(recession.scenarios.every(s=>s.stressPresets.includes('recession'))).toBe(true);
    expect(recession.seed).toBe(control.seed);expect(recession.years).toBe(control.years);
    expect(recession.metadata.preview).toBe(true);
    expect(recession.metadata.robustness.criterion).toEqual(criterion);
  });
  test('denominators exclude failed and absent/nonfinite metrics, preserving ties',()=>{
    const result={experiment:{id:'actual',status:'completed'},runs:[
      {scenarioId:'plan-a',status:'completed',metrics:{affordability:60}},
      {scenarioId:'plan-a',status:'completed',metrics:{affordability:50}},
      {scenarioId:'plan-a',status:'failed',error:'model failure',metrics:{}},
      {scenarioId:'plan-a',status:'completed',metrics:{}},
      {scenarioId:'baseline',status:'completed',metrics:{affordability:99}},
    ]};
    const cell=summarizeRobustnessCell({result,scenarioId:'plan-a',criterion});
    expect(cell).toMatchObject({success:1,eligible:2,failed:1,missing:1,attempted:4,share:.5});
    expect(summarizeRobustnessCell({result,scenarioId:'plan-a',criterion:{...criterion,operator:'lte'}}).success).toBe(2);
    expect(scoreRobustness([{...cell,stressId:'recession'},{...cell,share:0,success:0,stressId:'supply'}])).toMatchObject({eligible:4,success:1,share:.25,failed:2});
    expect(scoreRobustness([]).share).toBeNull();
  });
  test('real model outcomes and identical per-index seeds flow into every matrix cell',async()=>{
    const input=source(),batches=['control','recession'].map(stressId=>buildRobustnessExperiment({input,planIds:['plan-a'],stressId,runs:10,criterion}));
    const result=[];
    for(const batch of batches)result.push(await executeDecisionExperiment({experiment:{...batch,id:`robust_${result.length}`},model:housingModel,simulateRun:simulateHousingRun,applyStressPresets}));
    expect(result[0].runs.map(r=>r.seed)).toEqual(result[1].runs.map(r=>r.seed));
    for(const run of result[1].runs)expect(run.sampledParameters.economic_growth).toBeLessThan(0);
    for(let index=0;index<result.length;index++)for(const scenarioId of ['baseline','plan-a']){
      const cell=summarizeRobustnessCell({result:result[index],scenarioId,criterion});
      const actual=result[index].runs.filter(r=>r.scenarioId===scenarioId&&r.status==='completed');
      expect(cell.eligible).toBe(actual.length);expect(cell.success).toBe(actual.filter(r=>r.metrics.affordability>=60).length);
    }
    expect(result[1].runs[0].metrics).not.toEqual(result[0].runs[0].metrics);
  });
  test('rejects missing criteria, too many plans, unknown stresses and oversized cells',()=>{
    const input=source();
    expect(()=>buildRobustnessExperiment({input,planIds:['plan-a'],stressId:'invented',criterion})).toThrow('known');
    expect(()=>buildRobustnessExperiment({input,planIds:['plan-a'],criterion:{...criterion,value:NaN}})).toThrow('finite');
    expect(()=>buildRobustnessExperiment({input,planIds:['plan-a'],runs:100,criterion})).toThrow('1–50');
    expect(()=>buildRobustnessExperiment({input,planIds:['missing'],criterion})).toThrow('available');
  });
});
