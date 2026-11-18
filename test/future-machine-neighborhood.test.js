import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createNeighborhood,architectureGeometry,facadeDetails} from '../world/future-machine/scene/neighborhood.js';
import {createDivergenceGate,createDivergenceBurst} from '../world/future-machine/scene/divergence.js';
import {createSpatialMapping} from '../world/future-machine/scene/mapping.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {disposeObjectResources} from '../world/future-machine/scene/resources.js';
function history(){const initial=initialForRecipe(),engine=createEngine();function run(intervention){let state=intervention?addIntervention(initial,intervention):structuredClone(initial);const steps=[];for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});}return {seed:initial.seed,modelVersion:initial.version,baseline:run(),plan:run(DEFAULT_RECIPE.intervention)};}
test('World architecture scenery cannot become model rows, metrics or pick identities',()=>{
 const h=history(),before=JSON.stringify(h),mapping=createSpatialMapping(),p=mapping.frame(h.baseline[16].state,h.plan[16].state);
 const scene=createNeighborhood(THREE,[...p.a,...p.b]);expect(scene.userData.decorative).toBe(true);expect(scene.children.length).toBeGreaterThan(20);
 scene.traverse(o=>{expect(o.userData.id).toBeUndefined();expect(o.userData.collection).toBeUndefined();});
 expect(JSON.stringify(h)).toBe(before);expect(p.b.filter(r=>r.collection==='buildings')).toHaveLength(h.plan[16].state.buildings.length);
 const old=p.b.find(r=>r.id==='building-d1'),added=p.b.find(r=>r.id==='building-project-policy-1-0');expect(added.height).toBeGreaterThan(old.height);
 const geometry=architectureGeometry(THREE,added);geometry.computeBoundingBox();expect(geometry.boundingBox.max.y-geometry.boundingBox.min.y).toBeGreaterThanOrEqual(added.height);geometry.dispose();disposeObjectResources(scene);
});
test('exact recorded event ID triggers once, never elapsed time, missing receipt or unchanged history',()=>{
 const h=history(),gate=createDivergenceGate(h);expect(gate.receipt).toMatchObject({eventMonth:16,id:'building-project-policy-1-0'});
 const frame=month=>({month,baseline:h.baseline[month],plan:h.plan[month]});expect(gate.take(frame(15))).toBeNull();
 const missing=structuredClone(frame(16));missing.plan.events=[];expect(gate.take(missing)).toBeNull();
 const forged=structuredClone(frame(16));forged.plan.events=forged.plan.events.map(e=>({...e,id:'different-id'}));expect(gate.take(forged)).toBeNull();
 expect(gate.take(frame(16)).eventId).toBe(gate.receipt.eventId);expect(gate.take(frame(16))).toBeNull();expect(gate.take(frame(17))).toBeNull();
 expect(createDivergenceGate({...h,plan:h.baseline}).receipt).toBeNull();
});
test('linked-panel burst shares phase, settles and releases scenery',()=>{
 const scenes=[new THREE.Scene(),new THREE.Scene()],burst=createDivergenceBurst(THREE,scenes,{x:24,z:0});
 expect(burst.tick(100)).toBe(true);burst.tick(1600);expect(scenes[0].children[0].children[0].scale.toArray()).toEqual(scenes[1].children[0].children[0].scale.toArray());
 expect(burst.tick(3100)).toBe(false);burst.dispose();expect(scenes.map(s=>s.children.length)).toEqual([0,0]);
});

test('instanced facade preserves every authored window transform and releases instance resources once',()=>{
 for(const height of [1.7,3,6,9,12,36])for(const muted of [false,true]){
  const facade=facadeDetails(THREE,height,muted),expected=[];
  for(let y=1.7;y<height;y+=3)for(const x of [-4,0,4])for(const side of [-1,1]){
   const pose=new THREE.Object3D();pose.position.set(x,y-height/2,side*7.06);pose.updateMatrix();expected.push(pose.matrix.clone());
   pose.rotation.y=Math.PI/2;pose.position.set(side*7.06,y-height/2,x);pose.updateMatrix();expected.push(pose.matrix.clone());
  }
  if(!expected.length){expect(facade.children).toHaveLength(0);continue;}
  expect(facade.children).toHaveLength(1);const windows=facade.children[0];expect(windows.isInstancedMesh).toBe(true);expect(windows.count).toBe(expected.length);
  expect(windows.geometry.parameters).toMatchObject({width:1.8,height:1.35,depth:.12});expect(windows.material.color.getHex()).toBe(muted?0x53666c:0xc5e0d6);expect(windows.material.roughness).toBe(.4);
  for(let i=0;i<expected.length;i++){const actual=new THREE.Matrix4();windows.getMatrixAt(i,actual);for(let n=0;n<16;n++)expect(actual.elements[n]).toBeCloseTo(expected[i].elements[n],5);}
  facade.traverse(object=>{expect(object.userData.id).toBeUndefined();expect(object.userData.collection).toBeUndefined();});
  const counts={instance:0,geometry:0,material:0};windows.addEventListener('dispose',()=>counts.instance++);windows.geometry.addEventListener('dispose',()=>counts.geometry++);windows.material.addEventListener('dispose',()=>counts.material++);
  const released=new Set();disposeObjectResources(facade,released);disposeObjectResources(facade,released);expect(counts).toEqual({instance:1,geometry:1,material:1});
 }
});
