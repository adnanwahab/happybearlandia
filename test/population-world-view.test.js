import {describe,test,expect} from 'bun:test';
import * as THREE from 'three';
import {visiblePopulationRows,interpolatePopulationPosition,populationRowMatchesFilter,createPopulationRenderer} from '../world/population/renderer.js';
import {deriveLivingContext} from '../world/population/world-view.js';
describe('living population visual evidence',()=>{
 test('town coordinates remain actual geometry while districts are explicitly synthetic',()=>{const town={source:'osm',origin:{lat:30,lng:-95},buildings:[{id:1,kind:'home',center:[-50,-50],height:10},{id:2,kind:'work',center:[50,50],height:20}]},before=JSON.stringify(town),context=deriveLivingContext(town);expect(context.buildings[0].center).toEqual([-50,-50]);expect(context.districts).toHaveLength(4);expect(context.provenance.calibrated).toBe(false);expect(context.provenance.districts).toContain('synthetic');expect(JSON.stringify(town)).toBe(before)});
 test('renderer strictly bounds worker rows and rejects absent/nonfinite positions',()=>{const visibleAgents=Array.from({length:100000},(_,id)=>({id,x:id,z:0}));expect(visiblePopulationRows({visibleAgents})).toHaveLength(500);expect(visiblePopulationRows({visibleAgents:[{id:'bad',x:NaN,z:1}]})).toEqual([]);expect(visiblePopulationRows(null)).toEqual([])});
 test('interpolation is between actual samples with no extrapolated synthetic destinations',()=>{expect(interpolatePopulationPosition({x:0,z:10},{x:10,z:0},.25)).toEqual({x:2.5,z:7.5});expect(interpolatePopulationPosition({x:0,z:0},{x:10,z:20},2)).toEqual({x:10,z:20})});
 test('behavior filters require actual flags/metrics; no inferred displacement',()=>{expect(populationRowMatchesFilter({currentActivity:'TRANSIT'},'commuting')).toBe(true);expect(populationRowMatchesFilter({housingBurden:.6},'stressed',{burdenThreshold:.35})).toBe(true);expect(populationRowMatchesFilter({housingBurden:.8},'displaced')).toBe(false);expect(populationRowMatchesFilter({flags:['displaced']},'displaced')).toBe(true);expect(populationRowMatchesFilter({},'movers')).toBe(false)});
 test('real Three instances/points interpolate, ray-select IDs and clean up without generating agents',()=>{const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,5000);camera.position.set(0,3,10);camera.lookAt(0,.8,0);camera.updateMatrixWorld();const view=createPopulationRenderer({scene,camera,THREE});view.setActive(true);view.updateFrame({visibleAgents:[{id:'near',x:0,z:0,currentActivity:'TRANSIT'},{id:'far',x:1000,z:0,currentActivity:'WORK'}]},100);view.update(150);scene.updateMatrixWorld();expect(view.getStats()).toMatchObject({visible:2,near:1,far:1,limit:500});const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);expect(view.pick(ray)?.personId).toBe('near');view.updateFrame({visibleAgents:[{id:'near',x:10,z:0,currentActivity:'TRANSIT'}]},200);expect(view.getPosition('near',225)).toEqual({x:2.5,z:0});view.setActive(false);expect(view.pick(ray)).toBeNull();view.destroy();expect(scene.children).toHaveLength(0)});
});

test('actual worker frames retain selected needs and rates across a model step',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');
 const runtime=createPopulationRuntime({config:{population:80,seed:77}});
 try{
  await runtime.ready;runtime.pause();
  const row=runtime.getSnapshot().visibleAgents[0];
  expect(row.needs.energy).toBeGreaterThan(0);
  expect(row.needRates.energy).toBeGreaterThan(0);
  expect(row.needActivity).toContain('sleeping');
  await runtime.inspectPerson(row.id);await runtime.step();
  const next=runtime.getSnapshot().visibleAgents.find(person=>person.id===row.id);
  expect(next.needs.energy).toBeGreaterThan(row.needs.energy);
  expect(next.needs.hunger).toBeLessThan(row.needs.hunger);
  expect(next.needsSource).toBeDefined();
 }finally{runtime.destroy();}
});

test('pause freezes interpolation exactly and resume excludes paused wall time',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),view=createPopulationRenderer({scene,camera,THREE});
 view.setActive(true);view.updateFrame({visibleAgents:[{id:'p',x:0,z:0}]},100);
 view.updateFrame({visibleAgents:[{id:'p',x:10,z:0}]},200);
 view.setPaused(true,225);expect(view.getPosition('p',900)).toEqual({x:2.5,z:0});
 view.update(900);view.setPaused(false,1025);
 expect(view.getPosition('p',1025)).toEqual({x:2.5,z:0});
 expect(view.getPosition('p',1050)).toEqual({x:5,z:0});view.destroy();
});
