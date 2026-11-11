import {test,expect} from 'bun:test';
import {createFactorialDesign,evaluateFactorial} from '../world/decision/backlog-statistics/design.js';
import {runHousingFactorial} from '../world/decision/backlog-statistics/housing.js';
import {partialDependenceChart,factorialReport} from '../world/decision/backlog-statistics/view.js';
import {createHousingScenarios,simulateHousingRun,resolveHousingModel} from '../world/models/housing/index.js';
const options={factors:[{id:'x',levels:[-1,1]},{id:'y',levels:[-1,1]}],seeds:[0,42]};
test('exact analytical additive and interaction partition with seed matching',async()=>{
 const calls=[];const r=await evaluateFactorial(options,({parameters:{x,y},seed,cell})=>{calls.push([cell,seed]);return 2*x+3*y+4*x*y+seed;});
 expect(r.totalVariance).toBe(29);expect(r.components.map(c=>c.variance)).toEqual([4,9,16]);expect(calls.length).toBe(8);expect(r.components.reduce((s,c)=>s+c.share,0)).toBeCloseTo(1,12);
 expect(await evaluateFactorial(options,({parameters:{x,y},seed})=>2*x+3*y+4*x*y+seed)).toEqual(r);
});
test('three factor reference and zero variance',async()=>{
 const r=await evaluateFactorial({...options,factors:[...options.factors,{id:'z',levels:[-1,1]}]},({parameters:{x,y,z}})=>x*y*z);
 expect(r.components.map(c=>c.variance)).toEqual([0,0,0,0,0,0,1]);
 const zero=await evaluateFactorial(options,()=>5);expect(zero.components.every(c=>c.share===null)).toBe(true);
});
test('refuses budgets, unsupported distributions and unbalanced duplicates',()=>{
 for(const change of [{budget:7},{distribution:'normal'},{seeds:[1,1]},{factors:[{id:'x',levels:[0,0]}]},{budget:129}]) expect(()=>createFactorialDesign({...options,...change})).toThrow();
});
test('missing, failed, cancelled evaluations cannot yield decomposition',async()=>{
 const r=await evaluateFactorial(options,({cell})=>cell===0?null:2);expect(r.available).toBe(false);expect(r.components).toBeNull();expect(r.evaluations.length).toBe(8);expect(factorialReport(r)).toContain('2 failed');
 const c=new AbortController();c.abort();expect((await evaluateFactorial(options,()=>1,{signal:c.signal})).status).toBe('cancelled');
});
test('real versioned housing design equals direct matched runs, preserves input',async()=>{
 const parameters=createHousingScenarios()[1].parameters,years=2,seed=0;
 const run={...simulateHousingRun({parameters,years,seed}),id:'actual',seed,sampledParameters:parameters,inputProjects:[]};
 const before=JSON.stringify(run);const factors=[{id:'interest_rate',levels:[0.02,0.1]},{id:'construction_capacity',levels:[50000,90000]}];
 const args={run,years,metricId:'median_rent',factors,seeds:[0,4294967295]};
 const r=await runHousingFactorial(args);expect(r.available).toBe(true);expect(r.provenance.empirical).toBe(false);
 for(const e of r.evaluations) expect(e.value).toBe(resolveHousingModel(run.modelVersion).simulateRun({parameters:{...parameters,...r.design.cells[e.cell]},years,seed:e.seed,projects:[],scheduledStress:[]}).metrics.median_rent);
 expect(JSON.stringify(run)).toBe(before);expect(await runHousingFactorial(args)).toEqual(r);
 await expect(runHousingFactorial({...args,run:{...run,metrics:{...run.metrics,median_rent:-1}}})).rejects.toThrow('mismatch');
 await expect(runHousingFactorial({...args,factors:[{id:'unknown',levels:[0,1]}]})).rejects.toThrow();
});
test('PDP charts actual numeric means with accessible table, escape labels and gap',()=>{
 const html=partialDependenceChart({parameterId:'<script>',metricId:'rent',points:[{value:0,mean:2,count:2},{value:1,mean:null,count:0},{value:2,mean:5,count:2}]});
 expect(html).toContain('<svg');expect(html).toContain('<table>');expect(html).not.toContain('<line');expect(html).not.toContain('<script>');expect(html).not.toContain('NaN');
});
test('adapter retains historical version, schedule, approved projects and fork',async()=>{
 const {createBuildingProposal}=await import('../world/buildings/proposal.js');
 const parameters=createHousingScenarios()[1].parameters,years=3,seed=42;
 for(const version of ['1.1.0','1.2.0']) {
  const resolved=resolveHousingModel(version);
  const input={parameters,years,seed,projects:[createBuildingProposal({id:'statistics-tower',status:'approved'})],scheduledStress:[]};
  if(version==='1.2.0') input.scheduledStress=[{presetId:'budget-cut',startMonth:12}];
  if(version==='1.2.0') input.fork={month:12,operations:[{op:'set_parameter',target:'interest_rate',value:0.08}]};
  const run={...resolved.simulateRun(input),seed,sampledParameters:parameters,inputProjects:input.projects,scheduledStress:input.scheduledStress};
  const r=await runHousingFactorial({run,years,metricId:'median_rent',factors:[{id:'construction_capacity',levels:[50000,90000]}]});
  expect(r.provenance.modelVersion).toBe(version);
  for(const e of r.evaluations) expect(e.value).toBe(resolved.simulateRun({...input,parameters:{...parameters,...r.design.cells[e.cell]}}).metrics.median_rent);
 }
});
test('offset-stable orthogonal effects reconstruct total within declared tolerance',async()=>{
 const r=await evaluateFactorial(options,({parameters:{x,y}})=>1e12+2*x+3*y+0.125*x*y);
 expect(r.available).toBe(true);expect(r.components.map(c=>c.variance)).toEqual([4,9,0.015625]);
 expect(Math.abs(r.reconstruction.residual)).toBeLessThanOrEqual(r.reconstruction.tolerance);
 const overflow=await evaluateFactorial(options,({parameters:{x}})=>x*1e308);
 expect(overflow.available).toBe(false);expect(overflow.status).toBe('numerical-failure');
});
test('cancellation during the final evaluation cannot publish completed decomposition',async()=>{
 const controller=new AbortController();
 const r=await evaluateFactorial(options,()=>7,{signal:controller.signal,onProgress:({completed,total})=>{if(completed===total)controller.abort();}});
 expect(r.status).toBe('cancelled');expect(r.available).toBe(false);
 for(const seeds of [[-1],[4294967296],[1.5],[NaN]]) expect(()=>createFactorialDesign({...options,seeds})).toThrow();
});
test('Housing refuses retained timed/fork overrides rather than mislabeling effective levels',async()=>{
 const parameters=createHousingScenarios()[1].parameters,years=2,seed=4294967295;
 for(const extra of [
  {scheduledStress:[{presetId:'recession',startMonth:6}]},
  {fork:{month:6,operations:[{op:'set_parameter',target:'scenario.parameters.interest_rate',value:0.1}]}},
  {fork:{month:6,operations:[{op:'apply_stress_preset',target:'stressPresets',value:'recession'}]}}
 ]) {
  const input={parameters,years,seed,...extra};
  const run={...simulateHousingRun(input),seed,sampledParameters:parameters,inputProjects:[],scheduledStress:extra.scheduledStress||[]};
  const factor=extra.scheduledStress||extra.fork.operations[0].op==='apply_stress_preset'?'economic_growth':'interest_rate';
  await expect(runHousingFactorial({run,years,metricId:'median_rent',factors:[{id:factor,levels:[0.02,0.03]}]})).rejects.toThrow('overridden');
 }
});
test('unequal factor level counts retain equal product weights and report exact manifest',async()=>{
 const r=await evaluateFactorial({factors:[{id:'x',levels:[-1,0,1]},{id:'y',levels:[-1,1]}],seeds:[0]},({parameters:{x,y}})=>x+2*y);
 expect(r.totalVariance).toBeCloseTo(2/3+4,12);
 expect(r.components[0].variance).toBeCloseTo(2/3,12);expect(r.components[1].variance).toBe(4);
 expect(r.components[2].variance).toBeLessThan(1e-28);
 expect(Math.abs(r.reconstruction.residual)).toBeLessThanOrEqual(r.reconstruction.tolerance);
 const html=factorialReport(r);expect(html).toContain('data-statistics-manifest');expect(html).toContain('data-statistics-variance');expect(html).not.toContain('NaN');
});
test('cross-engine audit discloses accepted arithmetic differences and blocks material/missing metrics',async()=>{
 const {auditRecordedMetrics}=await import('../world/decision/backlog-statistics/reconstruction.js');
 const audit=auditRecordedMetrics({rent:1800,housing:1000000,missing:3},{rent:1800+2e-12,housing:1000000.01});
 expect(audit.roundoff.map(c=>c.metricId)).toEqual(['rent']);expect(audit.mismatches).toEqual(['housing','missing']);
 expect(audit.roundoff[0].delta).not.toBe(0);
 const {runHousingDiagnosticCounterfactual}=await import('../world/decision/backlog-statistics/reconstruction.js');
 const parameters=createHousingScenarios()[1].parameters,seed=42,years=2;
 const run={...simulateHousingRun({parameters,seed,years}),seed,sampledParameters:parameters,inputProjects:[]};
 const actual=run.metrics.median_rent;run.metrics.median_rent+=2e-12;
 const r=runHousingDiagnosticCounterfactual({run,years,parameterId:'interest_rate',value:0.1,metricId:'median_rent'});
 expect(r.recordedMismatch).toEqual([]);expect(r.baseline.metrics.median_rent).toBe(actual);expect(r.reconstructionAudit.roundoff).toHaveLength(1);
 run.metrics.median_rent+=0.001;expect(runHousingDiagnosticCounterfactual({run,years,parameterId:'interest_rate',value:0.1}).recordedMismatch).toContain('median_rent');
});
test('audited Housing PDP executes real reruns and retains every source audit without changing stored values',async()=>{
 const {runHousingPartialDependence}=await import('../world/decision/backlog-statistics/reconstruction.js');
 const parameters=createHousingScenarios()[1].parameters,seed=42,years=2;
 const run={...simulateHousingRun({parameters,seed,years}),id:'audited-source',status:'completed',seed,sampledParameters:parameters,inputProjects:[]};
 run.metrics.median_rent+=2e-12;const before=JSON.stringify(run);
 const r=await runHousingPartialDependence({runs:[run],years,parameterId:'interest_rate',metricId:'median_rent',values:[0.02,0.1]});
 expect(r.executions).toBe(2);expect(r.reconstructionAudits[0].roundoff).toHaveLength(1);expect(JSON.stringify(run)).toBe(before);
 expect(partialDependenceChart(r)).toContain('Source reconstruction arithmetic audit');
 run.metrics.median_rent+=0.01;
 await expect(runHousingPartialDependence({runs:[run],years,parameterId:'interest_rate',metricId:'median_rent',values:[0.02,0.1]})).rejects.toThrow('mismatch');
});
