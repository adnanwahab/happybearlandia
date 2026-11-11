import {test,expect} from 'bun:test';
import {initialForRecipe,normalizeReplay,getFrame} from '../world/future-machine/data/index.js';
import {stateHash,freeze} from '../world/future-machine/data/core.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {compareFrame} from '../world/future-machine/diff/index.js';
import {createSpatialMapping} from '../world/future-machine/scene/mapping.js';
import {createCanvasStage,canvasRows,canvasPoint,canvasViewports} from '../world/future-machine/scene/canvas-stage.js';
function history(){const initial=initialForRecipe();function run(policy){const engine=createEngine(),steps=[];let state=policy?addIntervention(initial,policy):initial;for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});}return freeze({baseline:run(null),plan:run(DEFAULT_RECIPE.intervention)});}
function container(){const context=new Proxy({},{get:()=>()=>{},set:()=>true});const canvas={style:{},setAttribute(){},getContext:()=>context,addEventListener(){},removeEventListener(){},remove(){}};return {clientWidth:800,clientHeight:400,ownerDocument:{createElement:()=>canvas},append(){}};}

test('real City reverse scrub has no future structure at zero and preserves exact schematic IDs',async()=>{
 const h=history(),before=await stateHash(h),added='building-project-policy-1-0',mapping=createSpatialMapping();
 // Match the coordinator stage: reserve slots across the full history before viewing.
 for(let month=0;month<=120;month++)mapping.frame(h.baseline[month].state,h.plan[month].state);
 const expected=new Map();
 for(const month of [0,16,120,16,0,120,0]){
  const f=getFrame(h,month),projection=mapping.frame(f.baseline.state,f.plan.state),diff=compareFrame(f);
  expect(projection.month).toBe(month);expect(projection.a.some(r=>r.id===added)).toBe(false);
  expect(projection.b.some(r=>r.id===added)).toBe(month>=16);
  for(const row of [...projection.a,...projection.b]){const id=`${row.collection}:${row.id}`,coordinates={x:row.x,z:row.z,mapping:row.mapping};if(expected.has(id))expect(coordinates).toEqual(expected.get(id));else expected.set(id,coordinates);}
  for(const mode of ['split','difference','baseline','plan'])for(const arm of ['baseline','plan']){
   const rows=canvasRows(projection,diff,arm,mode);
   if(month===0){expect(rows.some(r=>r.id===added)).toBe(false);if(mode==='difference')expect(rows).toEqual([]);}
   else if(mode==='difference'||arm==='plan')expect(rows.some(r=>r.id===added)).toBe(true);
   const actual=rows.find(r=>r.id===added&&!r.ghost);if(actual)expect(actual.arm).toBe('plan');
  }
 }
 expect(await stateHash(h)).toBe(before);
});

test('actual reverse scrub and split/difference preserve one Canvas camera and viewport scale',()=>{
 const h=history(),mapping=createSpatialMapping(),stage=createCanvasStage(container());
 for(let month=0;month<=120;month++)mapping.frame(h.baseline[month].state,h.plan[month].state);
 const camera={x:47,z:13,zoom:2};
 try{for(const month of [0,16,120,16,0]){
  const f=getFrame(h,month),p=mapping.frame(f.baseline.state,f.plan.state);stage.update(p,compareFrame(f));
  if(month===0)stage.setCamera(camera);
  for(const mode of ['split','difference','plan','baseline']){stage.setMode(mode);expect(stage.getCamera()).toEqual(camera);expect(stage.getStats().month).toBe(month);}
  const [a,b]=canvasViewports(800,400,'split'),row=p.a[0],pa=canvasPoint(row.x,row.z,camera,a),pb=canvasPoint(row.x,row.z,camera,b);
  expect(pb.x-pa.x).toBe(400);expect(pa.y).toBe(pb.y);
 }}finally{stage.dispose();}
});
