import {test, expect} from 'bun:test';
import * as THREE from 'three';
import {createVisualEffects, changedEntityKeys, firstPhysicalStop} from '../world/future-machine/scene/effects.js';
import {createEngine, addIntervention} from '../world/city/engine.js';
import {initialForRecipe, normalizeReplay} from '../world/future-machine/data/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {compareHistory, compareEntities} from '../world/future-machine/diff/index.js';
const row = (height=6) => ({collection:'buildings',id:'b1',height});
function mesh(height=6, material=new THREE.MeshStandardMaterial({color:0x123456})) {
  const result = new THREE.Mesh(new THREE.BoxGeometry(2,height,2), material);
  result.position.y = height/2;
  return result;
}
test('only explicit recorded changes animate; selection can glow without animation', () => {
  const effects=createVisualEffects({THREE}), ordinary=mesh(), changed=mesh(), selected=mesh();
  effects.apply(ordinary,row()); effects.apply(selected,row(),{selected:true});
  expect(effects.tick(0)).toBe(false);
  expect(ordinary.material.emissive.getHex()).toBe(0);
  expect(selected.material.emissive.getHex()).toBe(0xffc857);
  effects.apply(changed,row(),{changed:true,kind:'added'});
  expect(changed.scale.y).toBe(1); // An addition is already a recorded complete structure.
  expect(effects.tick(0)).toBe(true);
  expect(changed.material.emissive.getHex()).toBe(0x40d9c4);
  expect(effects.tick(900)).toBe(true);
  expect(effects.tick(901)).toBe(false);
  effects.apply(changed,row(),{changed:false});
  expect(changed.material.emissive.getHex()).toBe(0);
  effects.dispose();
});
test('same-identity recorded height transition is smooth, ground anchored and finite', () => {
  const effects=createVisualEffects({THREE}), target=mesh();
  effects.apply(target,row());
  target.geometry.dispose(); target.geometry=new THREE.BoxGeometry(2,12,2); target.position.y=6;
  effects.apply(target,row(12),{changed:true});
  expect(target.scale.y).toBe(.5);
  expect(effects.tick(10)).toBe(true); expect(target.position.y).toBe(3);
  effects.tick(460); expect(target.scale.y).toBe(.75); expect(target.position.y).toBe(4.5);
  expect(effects.tick(910)).toBe(true);
  expect(effects.tick(911)).toBe(false); expect(target.scale.y).toBe(1); expect(target.position.y).toBe(6);
  expect(effects.tick(NaN)).toBe(false);
  effects.dispose();
});
test('reduced motion and ghosts never animate; no height tween without changed evidence', () => {
  for (const options of [{reducedMotion:true},{}]) {
    const effects=createVisualEffects({THREE,...options}), target=mesh();
    effects.apply(target,row()); target.position.y=6;
    effects.apply(target,row(12),{changed:true,ghost:!options.reducedMotion});
    expect(effects.tick(0)).toBe(false); expect(target.scale.y).toBe(1);
    effects.apply(target,row(18)); expect(effects.tick(0)).toBe(false);
    effects.dispose();
  }
});
test('material arrays are isolated and disposed once; original materials remain owned by stage', () => {
  const originals=[new THREE.MeshStandardMaterial(),new THREE.MeshStandardMaterial()], target=mesh(6,originals);
  const effects=createVisualEffects({THREE}); effects.apply(target,row(),{changed:true});
  let clonesDisposed=0, originalsDisposed=0;
  for (const material of target.material) material.addEventListener('dispose',()=>clonesDisposed++);
  for (const material of originals) material.addEventListener('dispose',()=>originalsDisposed++);
  expect(target.material[0]).not.toBe(originals[0]); expect(originals[0].emissive.getHex()).toBe(0);
  effects.dispose(); effects.dispose();
  expect(target.material).toBe(originals); expect(clonesDisposed).toBe(2); expect(originalsDisposed).toBe(0);
  expect(effects.tick(0)).toBe(false);
  effects.apply(target,row(),{changed:true}); expect(target.material).toBe(originals);
});
test('flat and structured diffs preserve exact collection keys and partial valid evidence', () => {
  expect([...changedEntityKeys({available:false,entities:[{collection:'buildings',id:'same'},{collection:'projects',id:'same'}]})]).toEqual(['buildings:same','projects:same']);
  expect([...changedEntityKeys({entities:{buildings:{added:[{id:'b'}],removed:[],modified:[{id:'c'}]}}})]).toEqual(['buildings:b','buildings:c']);
  expect(changedEntityKeys(null).size).toBe(0);
});
test('fixed seed actual monthly model yields +24 homes and first mapped physical stop', () => {
  const initial=initialForRecipe(), engine=createEngine();
  function replay(intervention) {
    let state=intervention?addIntervention(initial,intervention):structuredClone(initial);
    const steps=[];
    for(let i=0;i<120;i++){const step=engine.step(state); steps.push(step);state=step.state;}
    return normalizeReplay(initial,{steps});
  }
  const history={seed:42,modelVersion:DEFAULT_RECIPE.modelVersion,baseline:replay(),plan:replay(DEFAULT_RECIPE.intervention)};
  const diffs=compareHistory(history), stop=firstPhysicalStop(history,diffs);
  expect(history.plan[120].metrics.housingUnits-history.baseline[120].metrics.housingUnits).toBe(24);
  expect(history.plan[120].metrics.capitalSpending).toBe(1000000);
  expect(stop).not.toBe(null);
  expect(diffs[stop.month].entities.some(e=>e.id===stop.entity.id && e.physical)).toBe(true);
  expect(history.plan[stop.month].state.buildings.some(b=>b.id===stop.entity.id)).toBe(true);
  expect(firstPhysicalStop(history,[{month:stop.month,...compareEntities(history.baseline[stop.month].state,history.plan[stop.month].state)}])).toEqual(stop);
  console.log('Effects verified model stop:',JSON.stringify(stop));
  expect(firstPhysicalStop(history,[diffs[0]])).toBe(null);
  expect(firstPhysicalStop({},diffs)).toBe(null);
});

test('reapplying a retained row does not restart its pulse; removing releases its effect', () => {
  const effects=createVisualEffects({THREE}), target=mesh();
  effects.apply(target,row(),{changed:true});effects.tick(0);
  effects.apply(target,row(),{changed:true});effects.tick(900);
  expect(effects.tick(901)).toBe(false);
  const original=target.material;let disposed=0;original.addEventListener('dispose',()=>disposed++);
  effects.remove(target);expect(disposed).toBe(1);
  effects.dispose();expect(disposed).toBe(1);
});
