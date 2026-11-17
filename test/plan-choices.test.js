import {test,expect} from 'bun:test';
import {stagePlan,customPlan,expectation} from '../world/plan-choices.js';
import {computeEffectsForYear} from '../world/policy.js';
const recipes=[['t_brt','h_lots','f_drainage','s_311'],['t_bus','s_311','sb_filing'],['t_brt','h_vouchers','f_drainage','sb_payroll']];
test('cards stage the exact worker parameters at every implementation year, including zero',()=>{
  for(const proposalIds of recipes)for(let year=0;year<=10;year++){expect(stagePlan({proposalIds},year)).toEqual(computeEffectsForYear(proposalIds,year));expect(stagePlan({ids:proposalIds},year)).toEqual(stagePlan({proposalIds},year));}
  expect(expectation(stagePlan({proposalIds:recipes[0]},3).effects)).toContain('housing growth 14%');
});
test('custom effects retain exact bounded values and no unrelated programs',()=>{
  const plan=customPlan();Object.assign(plan.customEffects,{speedMult:1.73,floodMitigation:.23,housingGrowth:.51,voucherMonthly:47});
  for(const year of [0,3,10])expect(stagePlan(plan,year).effects).toEqual({...computeEffectsForYear([],year).effects,...plan.customEffects});
  for(const bad of [NaN,Infinity,-1,200]){plan.customEffects.voucherMonthly=bad;expect(()=>stagePlan(plan,3)).toThrow('Invalid custom lever');}
});
