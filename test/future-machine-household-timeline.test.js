import {test,expect} from 'bun:test';
import {householdTimeline} from '../world/future-machine/ui/household-timeline.js';
const snapshot=(month,savings=0)=>({month,state:{month,version:'v1',seed:42,households:[{id:'h1',unitId:'u1',income:2000,savings}],units:[{id:'u1',householdId:'h1',status:'occupied',rent:500}]}});
const history=()=>({seed:42,modelVersion:'v1',baseline:[snapshot(0),snapshot(1,1),snapshot(3,10),snapshot(4,11)],plan:[snapshot(0),snapshot(1,2),snapshot(3,20),snapshot(4,20)]});
test('paired changes retain exact time and identity without filling gaps',()=>{
  const h=history(),before=JSON.stringify(h),rows=householdTimeline(h,'h1');
  expect(rows[1].changes).toEqual([['savings'],['savings']]);
  expect(rows[2].baseline).toBeNull();expect(rows[3].changes).toEqual([[],[]]);
  expect(rows[4].changes).toEqual([['savings'],[]]);expect(rows[1].plan.unitId).toBe('u1');
  expect(rows[0].baseline.savings).toBe(0);expect(JSON.stringify(h)).toBe(before);
  expect(householdTimeline(h,'absent').every(row=>row.baseline===null&&row.plan===null)).toBe(true);
  expect(householdTimeline(h,'h1')).toEqual(rows);
});
test('reject duplicate times and mismatched model, seed and state clocks',()=>{
  for(const patch of [{version:'v2'},{seed:43},{month:2}]){const h=history();Object.assign(h.plan[1].state,patch);expect(()=>householdTimeline(h,'h1')).toThrow();}
  const h=history();h.plan.push(snapshot(1));expect(()=>householdTimeline(h,'h1')).toThrow();
});

test('actual City engine pair repeats household observations with matched provenance',async()=>{
  const {createCity}=await import('../world/city/seed.js');
  const {createEngine,addIntervention}=await import('../world/city/engine.js');
  function run(){const engine=createEngine(),initial=engine.initialize(createCity({seed:42,households:6}));const arm=policy=>{let state=policy?addIntervention(initial,{type:'housing',districtId:'d1',amount:24,cost:1000000,delay:0,compliance:1}):initial;const snapshots=[{month:0,state:initial}];for(let i=0;i<12;i++){state=engine.step(state).state;snapshots.push({month:state.month,state});}return snapshots;};return {seed:42,modelVersion:initial.version,baseline:arm(false),plan:arm(true)};}
  const a=run(),id=a.baseline[0].state.households[0].id,rows=householdTimeline(a,id);
  expect(rows).toEqual(householdTimeline(run(),id));expect(rows[0].baseline).toEqual(rows[0].plan);
  expect(rows[12].baseline.income).toBe(a.baseline[12].state.households.find(h=>h.id===id).income);
  expect(rows[13].baseline).toBeNull();
});
