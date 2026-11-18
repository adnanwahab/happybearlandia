import {test,expect} from 'bun:test';
import {DISTRICT_METRICS,districtMetrics,validateMetricRegistry} from '../world/city/neighborhood-metrics.js';
import {pairedDistrictMetrics} from '../world/city/paired-neighborhood-diff.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
const initial=initialForRecipe();
const metric=(state,id,district='d1')=>districtMetrics(state).find(r=>r.metricId===id&&r.geographyId===district);
function pair(recipe=DEFAULT_RECIPE){
 const start=initialForRecipe(recipe),engine=createEngine();
 const replay=intervention=>{let state=intervention?addIntervention(start,intervention):structuredClone(start);const steps=[];for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(start,{steps});};
 return {baseline:replay(null),plan:replay(recipe.intervention)};
}
test('versioned provisional registry has twelve stable, unique source-backed metrics',()=>{
 expect(DISTRICT_METRICS).toHaveLength(12);expect(()=>validateMetricRegistry([...DISTRICT_METRICS,DISTRICT_METRICS[0]])).toThrow('Duplicate');
 expect(districtMetrics(initial)).toHaveLength(initial.districts.length*12);
 for(const m of DISTRICT_METRICS){expect(Array.isArray(initial[m.source])).toBe(true);expect(m.unit.length).toBeGreaterThan(0);}
 expect(DISTRICT_METRICS.every(m=>m.evidenceClass.includes('synthetic'))).toBe(true);
});
test('district partitions reconcile counts, population and employment without mutation',()=>{
 const before=JSON.stringify(initial),rows=districtMetrics(initial,{runId:'test',scenarioId:'baseline',runIndex:0});
 const sum=id=>rows.filter(r=>r.metricId===id).reduce((n,r)=>n+r.value,0);
 expect(sum('population')).toBe(initial.households.reduce((n,h)=>n+h.size,0));expect(sum('housing_units')).toBe(initial.units.length);
 expect(sum('employed_workers')).toBe(initial.workers.filter(w=>w.jobId!==null).length);expect(sum('unfilled_jobs')).toBe(initial.jobs.filter(j=>j.workerId===null).length);
 expect(rows[0]).toMatchObject({runId:'test',scenarioId:'baseline',runIndex:0,month:0,cellValue:null,locationBasis:'unavailable'});
 expect(JSON.stringify(initial)).toBe(before);
});
test('rental mean excludes owners, zero rent stays zero, empty mean remains unavailable',()=>{
 const s=structuredClone(initial);s.units=[{id:'r1',districtId:'d1',tenure:'rental',rent:0},{id:'r2',districtId:'d1',tenure:'rental',rent:1000},{id:'o',districtId:'d1',tenure:'owned',rent:9000}];
 expect(metric(s,'mean_rental_unit_rent')).toMatchObject({value:500,numerator:1000,denominator:2,sampleCount:2});
 s.units=s.units.slice(0,1);expect(metric(s,'mean_rental_unit_rent').value).toBe(0);
 s.units=[];expect(metric(s,'mean_rental_unit_rent')).toMatchObject({value:null,status:'unavailable',denominator:0});expect(metric(s,'housing_units').value).toBe(0);
});
test('missing collection, invalid source and unlocated source are not numeric zeros',()=>{
 const s=structuredClone(initial);delete s.units;expect(metric(s,'housing_units').value).toBeNull();
 s.units=[{id:'missing',districtId:'d1',tenure:'rental',rent:null}];expect(metric(s,'mean_rental_unit_rent').reason).toBe('Source fields unavailable');
 s.units=[{id:'unlocated',districtId:'nowhere'}];expect(metric(s,'housing_units')).toMatchObject({value:null,coverage:{unlocatedRecords:1}});
 delete s.workers[0].jobId;expect(districtMetrics(s).find(r=>r.metricId==='employed_workers'&&r.geographyId===s.workers[0].districtId).value).toBeNull();
});
test('links use outgoing origin, unsupported models and duplicate districts fail',()=>{
 const s=structuredClone(initial);s.links=[{from:'d1',to:'d2',travelTime:10},{from:'d1',to:'d2',travelTime:30}];expect(metric(s,'outgoing_link_travel_time').value).toBe(20);expect(metric(s,'outgoing_link_travel_time','d2').value).toBeNull();
 expect(()=>districtMetrics({...initial,version:'other'})).toThrow();expect(()=>districtMetrics({...initial,districts:[initial.districts[0],initial.districts[0]]})).toThrow();
});
test('paired missing districts and fields remain unavailable; mismatched months/seeds rejected',()=>{
 const b=structuredClone(initial);b.districts=b.districts.filter(d=>d.id!=='d1');
 const rows=pairedDistrictMetrics({month:0,baseline:{state:initial},plan:{state:b}});expect(rows.filter(r=>r.geographyId==='d1').every(r=>r.delta===null)).toBe(true);
 for(const patch of [{month:1},{seed:43},{version:'other'}])expect(()=>pairedDistrictMetrics({month:0,baseline:{state:initial},plan:{state:{...initial,...patch}}})).toThrow();
});
test('real matched 120-month projections replay identically and disclose district +24 at month16',()=>{
 const start=performance.now(),a=pair(),b=pair();
 const projection=h=>h.baseline.map((snapshot,i)=>pairedDistrictMetrics({month:i,baseline:snapshot,plan:h.plan[i]},{runId:'test',runIndex:0}));
 const rows=projection(a);expect(JSON.stringify(rows)).toBe(JSON.stringify(projection(b)));expect(rows).toHaveLength(121);
 expect(rows[0].every(r=>r.delta===0||r.delta===null)).toBe(true);
 expect(rows[15].find(r=>r.metricId==='housing_units'&&r.geographyId==='d1').delta).toBe(0);
 expect(rows[16].find(r=>r.metricId==='housing_units'&&r.geographyId==='d1')).toMatchObject({baseline:12,plan:36,delta:24});
 expect(rows[120].filter(r=>r.metricId==='housing_units').reduce((n,r)=>n+r.delta,0)).toBe(24);
 const zero=pairedDistrictMetrics({month:120,baseline:a.baseline[120],plan:b.baseline[120]});expect(zero.every(r=>r.delta===0||r.delta===null)).toBe(true);
 console.info(`Two tiny 120-month pairs and district projections: ${Math.round(performance.now()-start)}ms`);
});
