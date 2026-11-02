import { test, expect } from 'bun:test';
import { rankScenarioFutures, compareRunWithMedian, deleteDecisionScenario, resetScenarioAssumptions, configuredUncertaintyCurve, setDraftParameter, setDraftUncertainty } from '../world/decision/advanced-studio.js';
import { executeDecisionExperiment } from '../world/decision/kernel.js';
import { normalizeDecisionInput } from '../world/decision/contracts.js';
import { housingModel, createHousingScenarios, simulateHousingRun } from '../world/models/housing/index.js';

const input = () => ({schemaVersion:'decision-experiment.v1',name:'UI test',decision:'Housing',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:10,years:5,scenarios:createHousingScenarios(),metadata:{}});
test('future shortcuts rank real successful rows in the metric direction and median comparison excludes missing values', () => {
  const results={model:{metrics:[{id:'rent',label:'Rent',unit:'USD',direction:'lower'}]},runs:[{id:'a',scenarioId:'plan',status:'completed',metrics:{rent:100}},{id:'b',scenarioId:'plan',status:'completed',metrics:{rent:200}},{id:'c',scenarioId:'plan',status:'completed',metrics:{rent:300}},{id:'bad',scenarioId:'plan',status:'failed',metrics:{rent:0}},{id:'other',scenarioId:'other',status:'completed',metrics:{rent:0}}]};
  const ranked=rankScenarioFutures({results,scenarioId:'plan',metricId:'rent'});
  expect([ranked.best.id,ranked.median.id,ranked.worst.id,ranked.count]).toEqual(['a','b','c',3]);
  expect(compareRunWithMedian(results,ranked.best)[0]).toMatchObject({median:200,delta:-100,count:3});
});
test('scenario deletion protects baseline and reset preserves named projects/history without mutating stored input', () => {
  const original=input();original.scenarios[1].projects=[{id:'approved-project'}];original.metadata.worldEditHistory=[{id:'revision'}];const bytes=JSON.stringify(original);
  expect(()=>deleteDecisionScenario(original,original.scenarios[0].id)).toThrow('baseline');
  expect(deleteDecisionScenario(original,original.scenarios[1].id).scenarios).toHaveLength(3);
  const reset=resetScenarioAssumptions(original,original.scenarios[1].id,createHousingScenarios());expect(reset.scenarios[1].projects).toEqual([{id:'approved-project'}]);expect(reset.metadata.worldEditHistory).toEqual([{id:'revision'}]);expect(JSON.stringify(original)).toBe(bytes);
});
test('uncertainty sketches represent configured densities, including a boundary triangular mode', () => {
  const definition={min:0,max:10};const curve=configuredUncertaintyCurve(definition,{type:'triangular',min:0,max:10,mode:0},0);
  expect(curve.points[0][1]).toBe(1);expect(curve.points.at(-1)[1]).toBe(0);
  expect(configuredUncertaintyCurve(definition,{type:'uniform',min:2,max:4},3).points.every(([,y])=>y===1)).toBe(true);
  expect(configuredUncertaintyCurve(definition,null,3)).toMatchObject({type:'fixed',min:3,max:3,points:[]});
});
test('inherited slider and uncertainty edits survive normalization while parent-only edits still propagate', () => {
  const original=input();const parent=original.scenarios[1];original.scenarios.push({id:'child',name:'Inherited child',kind:'alternative',inheritsFrom:parent.id,overrides:{parameters:{permitting_months:10}}});
  const resolved=normalizeDecisionInput(original,housingModel),child=resolved.scenarios.at(-1);
  setDraftParameter(child,'construction_capacity',123456);resolved.scenarios[1].parameters.initial_rent=2100;
  const rerun=normalizeDecisionInput(resolved,housingModel);expect(rerun.scenarios.at(-1).parameters.construction_capacity).toBe(123456);expect(rerun.scenarios.at(-1).uncertainty.construction_capacity).toEqual({type:'fixed',value:123456});expect(rerun.scenarios.at(-1).parameters.initial_rent).toBe(2100);expect(rerun.scenarios.at(-1).parameters.permitting_months).toBe(10);
  setDraftUncertainty(child,'construction_capacity',{type:'uniform',min:100000,max:150000});expect(normalizeDecisionInput(resolved,housingModel).scenarios.at(-1).uncertainty.construction_capacity).toMatchObject({type:'uniform',min:100000,max:150000});
});

test('inherited slider override reaches actual sampled parameters in the common runner', async () => {
  const draft=input();draft.runs=2;draft.scenarios.push({id:'child',name:'Child',kind:'alternative',inheritsFrom:draft.scenarios[1].id,overrides:{}});
  const normalized=normalizeDecisionInput(draft,housingModel);setDraftParameter(normalized.scenarios.at(-1),'construction_capacity',123456);
  const experiment=normalizeDecisionInput(normalized,housingModel);experiment.id='ui-inheritance-run';
  const result=await executeDecisionExperiment({experiment,model:housingModel,simulateRun:simulateHousingRun});
  const rows=result.runs.filter(row=>row.scenarioId==='child');expect(rows).toHaveLength(2);expect(rows.every(row=>row.status==='completed'&&row.sampledParameters.construction_capacity===123456)).toBe(true);
});
