import {test,expect} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {cityMetrics} from '../world/city/engine.js';
import {captureEvidencePlan} from '../world/future-machine/capture-evidence.js';

function history(changeMonth=null) {
  const initial=createCity({households:6,seed:42});
  const baseline=Array.from({length:121},(_,month)=>{
    const state=structuredClone(initial);state.month=month;
    return {month,state,metrics:{...cityMetrics(state),capitalSpending:0}};
  });
  const plan=structuredClone(baseline);
  if(changeMonth!==null)for(const snapshot of plan.slice(changeMonth))snapshot.state.buildings[0].floors++;
  return {seed:42,modelVersion:initial.version,recipe:{schemaVersion:'future-machine.v1',seed:42,modelVersion:initial.version},baseline,plan};
}
for(const month of [1,37,120])test(`detects actual month ${month}, including modified existing buildings`,()=>{
  const pair=history(month),before=structuredClone(pair),report=captureEvidencePlan(pair);
  expect(report.divergenceMonth).toBe(month);expect(report.captureMonths).toEqual([0,month]);
  expect(report.scenarioVersion).toBe('future-machine.v1');expect(pair).toEqual(before);
  pair.baseline.reverse();pair.plan.reverse();expect(captureEvidencePlan(pair)).toEqual(report);
});
test('unchanged history reports no divergence without fabricating a capture',()=>{
  expect(captureEvidencePlan(history())).toMatchObject({status:'no-physical-divergence',divergenceMonth:null,captureMonths:[0]});
});
test('removal is physical while policy and financial differences are not',()=>{
  const pair=history();pair.plan[1].metrics.balance+=10;
  pair.plan[1].state.policies.push({id:'policy-test',type:'housing'});
  expect(captureEvidencePlan(pair).divergenceMonth).toBeNull();
  pair.plan[81].state.buildings.pop();
  expect(captureEvidencePlan(pair)).toMatchObject({divergenceMonth:81,captureMonths:[0,81]});
});
test('missing history, unmatched seed and changed month zero fail closed',()=>{
  const missing=history(37);missing.plan.splice(20,1);expect(()=>captureEvidencePlan(missing)).toThrow('complete');
  const wrong=history();wrong.recipe.seed=43;expect(()=>captureEvidencePlan(wrong)).toThrow('matching');
  expect(()=>captureEvidencePlan(history(0))).toThrow('common initial');
});
