import {test, expect} from 'bun:test';
import {householdCostAtlas} from '../world/decision/cost-atlas.js';
import {simulateHousingRun} from '../world/models/housing/index.js';
import {costAtlasFixture} from './fixtures/household-cost-atlas.js';
test('representative fixture is deterministic and conserves the supported ledger', () => {
 const {experiment,run,input}=costAtlasFixture();
 expect(simulateHousingRun(input)).toEqual(simulateHousingRun(input));
 const atlas=householdCostAtlas(experiment,run);
 expect(atlas.status).toBe('supported');
 expect(atlas.bins.reduce((sum,bin)=>sum+bin.value,0)).toBeCloseTo(run.metrics.public_expenditure,5);
 expect(atlas.count).toBeNull();expect(atlas.eligibleCount).toBeNull();
});
test('zero, missing and inconsistent ledgers never become inferred allocations',()=>{
 const {experiment,run}=costAtlasFixture();
 const zero={...run,metrics:{public_expenditure:0,low_income_rent_burden:0},accounting:{subsidySpent:0,voucherSpent:0,projectPublicSpent:0}};
 expect(householdCostAtlas(experiment,zero).status).toBe('supported');expect(householdCostAtlas(experiment,zero).burden).toBe(0);
 for(const value of [null,undefined,-1,NaN,Infinity,'0']) {
  const result=householdCostAtlas(experiment,{...run,accounting:{...run.accounting,voucherSpent:value}});
  expect(result.bins).toEqual([]);expect(result.status).toBe('unavailable');
 }
 expect(householdCostAtlas(experiment,{...run,metrics:{...run.metrics,public_expenditure:1}}).bins).toEqual([]);
 expect(householdCostAtlas(experiment,{...run,modelVersion:'1.1.0'}).burden).toBeNull();
 expect(householdCostAtlas({...experiment,modelId:'other'},run).bins).toEqual([]);
 expect(householdCostAtlas(experiment,null).status).toBe('unavailable');
});
