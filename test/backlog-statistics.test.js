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
