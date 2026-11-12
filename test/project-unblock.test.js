import {test,expect} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {inspectProject,compareProjectFix} from '../world/city/unblock.js';
function fixture() {
  const s=createCity({households:9});for(const p of s.parcels)p.capacity=0;s.parameters.annualGrowth=0;
  for(const u of s.utilities)u.capacity=1000;
  s.utilities.find(u=>u.districtId==='d0'&&u.type==='sewer').capacity=0;
  s.projects.push({id:'stalled',districtId:'d0',type:'housing',stage:'construction',units:20,amount:20,duration:1,progress:0,cost:100,costOverrun:0,displacedUnits:[],displacedBusinesses:[]});return s;
}
test('inspection names sewer shortage using actual next-month evidence without mutating saved state',()=>{
  const s=fixture(),before=structuredClone(s),r=inspectProject(s,'stalled');expect(r.constraints.some(c=>c.reason==='utility capacity')).toBe(true);expect(r.suggested).toBe('sewer');expect(r.utilities.find(u=>u.utility==='sewer').available).toBe(0);expect(s).toEqual(before);
});
test('same-seed sewer fix completes project and charges its public cost once',()=>{
  const state=fixture(),before=structuredClone(state),request={state,projectId:'stalled',fix:{resource:'sewer',amount:200,cost:12345},months:3,source:{experimentId:'city_saved',runIndex:0}};
  const a=compareProjectFix(request);expect(a).toEqual(compareProjectFix(request));expect(a.baseline.completionMonth).toBeNull();expect(a.tested.completionMonth).toBe(1);expect(a.capitalCostDelta).toBe(12345);expect(a.source.experimentId).toBe('city_saved');expect(state).toEqual(before);
});
test('a fix can leave a second constraint binding rather than promise completion',()=>{
  const s=fixture();s.utilities.find(u=>u.districtId==='d0'&&u.type==='water').capacity=0;
  const r=compareProjectFix({state:s,projectId:'stalled',fix:{resource:'sewer',amount:200,cost:10},months:3});expect(r.tested.completionMonth).toBeNull();expect(r.tested.events.some(e=>e.payload.reason==='utility capacity')).toBe(true);
});
test('labor and permit additions change actual completion timing',()=>{
  const s=fixture();s.projects[0].type='resilience';s.parameters.labor=0;
  const request={state:s,projectId:'stalled',fix:{resource:'labor',amount:100,cost:1000},months:4};expect(compareProjectFix(request).tested.completionMonth).toBe(1);expect(compareProjectFix(request).baseline.completionMonth).toBeNull();
  s.projects[0].stage='permit';s.parameters.labor=100;s.parameters.permits=0;
  const r=compareProjectFix({...request,fix:{resource:'permits',amount:1,cost:100}});expect(r.tested.completionMonth).toBe(2);expect(r.baseline.completionMonth).toBeNull();
});
test('unfunded and invalid comparisons fail explicitly',()=>{
  const state=fixture();for(const fix of [{resource:'sewer',amount:-1,cost:0},{resource:'sewer',amount:200,cost:Infinity},{resource:'bogus',amount:1,cost:0},{resource:'sewer',amount:1,cost:state.finance.balance+1},{resource:'permits',amount:.5,cost:0}])expect(()=>compareProjectFix({state,projectId:'stalled',fix})).toThrow();
  expect(()=>compareProjectFix({state,projectId:'missing',fix:{resource:'sewer',amount:200,cost:0}})).toThrow();
  expect(()=>compareProjectFix({state,projectId:'stalled',fix:{resource:'sewer',amount:200,cost:0},months:61})).toThrow();
});

test('reports months earlier only when both continuations complete',()=>{
  const state=fixture();state.projects[0].type='resilience';state.projects[0].units=0;state.parameters.labor=5;
  const r=compareProjectFix({state,projectId:'stalled',fix:{resource:'labor',amount:5,cost:0},months:4});
  expect(r.baseline.completionMonth).toBe(2);expect(r.tested.completionMonth).toBe(1);expect(r.monthsEarlier).toBe(1);
});
