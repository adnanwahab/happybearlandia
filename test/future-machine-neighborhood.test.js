import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {createNeighborhood,architectureGeometry} from '../world/future-machine/scene/neighborhood.js';
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
