import {beforeAll,expect,test} from 'bun:test';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {freeze} from '../world/future-machine/data/core.js';
import {compareFrame} from '../world/future-machine/diff/index.js';
import {constructionReceipts} from '../world/future-machine/evidence.js';
import {describeSelection} from '../world/future-machine/story/index.js';

const building={collection:'buildings',id:'building-project-policy-1-0'};
const project={collection:'projects',id:'project-policy-1-0'};
let history,source;
beforeAll(()=>{
 const initial=initialForRecipe(),engine=createEngine();
 const run=intervention=>{
  let state=intervention?addIntervention(initial,intervention):structuredClone(initial);
  const steps=[];
  for(let month=1;month<=120;month++){const step=engine.step(state);steps.push(step);state=step.state;}
  return normalizeReplay(initial,{steps});
 };
 history={baseline:run(),plan:run(DEFAULT_RECIPE.intervention)};
 source=JSON.stringify(history);freeze(history);
});
const frameAt=month=>({month,baseline:history.baseline[month],plan:history.plan[month]});
const describe=(month,entity)=>{const frame=frameAt(month);return describeSelection(frame,compareFrame(frame),entity);};

// Actual City completion: current-month descriptions and historical receipts
// remain separate even after repeated inspector selections.
test('repeated real building selection retains exactly one historical completion and never mutates history',()=>{
 expect(history.baseline).toHaveLength(121);expect(history.plan).toHaveLength(121);
 expect(history.plan[16].metrics.housingUnits-history.baseline[16].metrics.housingUnits).toBe(24);
 const expected=constructionReceipts(history,building,16);
 expect(expected).toHaveLength(1);
 expect(expected[0]).toMatchObject({future:'plan',eventId:'16-0',month:16,type:'PROJECT_COMPLETE',policyId:'policy-1-0',entity:building,payload:{projectId:project.id,units:24}});
 for(const month of [16,120,16,120,16]){
  const receipts=constructionReceipts(history,building,month);
  expect(receipts).toEqual(expected);
  expect(new Set(receipts.map(row=>`${row.future}:${row.eventId}`)).size).toBe(receipts.length);
  expect(describe(month,building).title).toBe(`buildings ${building.id} · Month ${month}`);
 }
 // Decorating a returned record must not change subsequent inspections.
 expected[0].payload.units=999;expected[0].policyId='consumer-only';
 expect(constructionReceipts(history,building,120)[0]).toMatchObject({policyId:'policy-1-0',payload:{units:24}});
 expect(JSON.stringify(history)).toBe(source);
});

test('selected-month labels and current events remain distinct from historical completion time on reverse scrub',()=>{
 const at16=describe(16,project);
 expect(at16.title).toBe(`projects ${project.id} · Month 16`);
 expect(at16.evidence.filter(row=>row.eventId==='16-0')).toHaveLength(1);
 expect(at16.evidence.find(row=>row.eventId==='16-0')).toMatchObject({future:'b',month:16,type:'PROJECT_COMPLETE',payload:{projectId:project.id,units:24}});
 const at120=describe(120,building);
 expect(at120.title).toContain('Month 120');
 expect(at120.evidence.every(row=>row.month===120)).toBe(true);
 expect(constructionReceipts(history,building,120)[0].month).toBe(16);
 for(const month of [15,0,16,0]){
  expect(describe(month,building).title).toBe(`buildings ${building.id} · Month ${month}`);
  expect(constructionReceipts(history,building,month)).toHaveLength(month===16?1:0);
  if(month===0){expect(describe(month,building).evidence).toEqual([]);expect(history.plan[month].state.buildings.some(row=>row.id===building.id)).toBe(false);}
 }
 expect(describe(16,project)).toEqual(at16);
 expect(JSON.stringify(history)).toBe(source);
});

test('the same actual event ID in two futures remains two arm-scoped records',()=>{
 // A matched control may contain the same completed project in both futures.
 // Reuse the actual run rather than inventing completion payloads.
 const matched={baseline:history.plan,plan:history.plan};
 const receipts=constructionReceipts(matched,building,120);
 expect(receipts.map(row=>[row.future,row.eventId,row.month,row.payload.units])).toEqual([['baseline','16-0',16,24],['plan','16-0',16,24]]);
 expect(constructionReceipts(matched,building,0)).toEqual([]);
 expect(constructionReceipts(matched,building,120)).toEqual(receipts);
 const frame={month:16,baseline:history.plan[16],plan:history.plan[16]};
 const detail=describeSelection(frame,compareFrame(frame),project);
 expect(detail.evidence.filter(row=>row.eventId==='16-0').map(row=>row.future)).toEqual(['a','b']);
 expect(detail.evidence.filter(row=>row.eventId==='16-0').every(row=>row.month===16)).toBe(true);
 expect(JSON.stringify(history)).toBe(source);
});
