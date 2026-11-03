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

test('sample filters apply while paused without changing interpolation position',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),view=createPopulationRenderer({scene,camera,THREE});
 view.setActive(true);view.updateFrame({visibleAgents:[{id:'p',x:0,z:0,currentActivity:'TRANSIT'},{id:'q',x:20,z:0,currentActivity:'HOME'}]},100);
 view.updateFrame({visibleAgents:[{id:'p',x:10,z:0,currentActivity:'TRANSIT'},{id:'q',x:30,z:0,currentActivity:'HOME'}]},200);
 view.setPaused(true,225);view.setFilter('commuting');expect(view.getRows().map(row=>row.id)).toEqual(['p']);
 expect(view.getPosition('p',900)).toEqual({x:2.5,z:0});view.setFilter('all');expect(view.getRows()).toHaveLength(2);
 expect(view.getPosition('q',900)).toEqual({x:22.5,z:0});view.destroy();
});

test('screen picking respects offset canvas bounds, stable IDs and geometry occlusion',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,2,.1,5000);camera.position.set(0,12,30);camera.lookAt(0,1,0);camera.updateMatrixWorld();const view=createPopulationRenderer({scene,camera,THREE});view.setActive(true);const now=performance.now();view.updateFrame({visibleAgents:[{id:'left',x:-5,z:0},{id:'actual-target',x:5,z:0}]},now);view.update(now);scene.updateMatrixWorld(true);const bounds={left:120,top:80,width:800,height:400},projected=new THREE.Vector3(5,1.1,0).project(camera),x=bounds.left+(projected.x+1)*400,y=bounds.top+(1-projected.y)*200;
 expect(view.pickScreen(x+6,y,bounds)?.personId).toBe('actual-target');expect(view.pickScreen(20,20,bounds)).toBeNull();view.setHovered('actual-target');expect(view.getStats().hoveredId).toBe('actual-target');
 const wall=new THREE.Mesh(new THREE.BoxGeometry(30,30,2),new THREE.MeshBasicMaterial());wall.position.set(0,5,10);scene.add(wall);scene.updateMatrixWorld(true);expect(view.pickScreen(x,y,bounds,{occluders:[wall]})).toBeNull();wall.material.transparent=true;wall.material.opacity=.12;expect(view.pickScreen(x,y,bounds,{occluders:[wall]})?.personId).toBe('actual-target');wall.material.opacity=1;wall.userData.buildingDateFaded=true;expect(view.pickScreen(x,y,bounds,{occluders:[wall]})?.personId).toBe('actual-target');view.setActive(false);expect(view.pickScreen(x,y,bounds)).toBeNull();expect(view.getStats().hoveredId).toBeNull();view.destroy();wall.geometry.dispose();wall.material.dispose();
});
test('distant markers use a bounded pixel radius rather than a fixed world-unit hit threshold',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,2,.1,5000);camera.position.set(0,800,800);camera.lookAt(0,0,0);camera.updateMatrixWorld();const view=createPopulationRenderer({scene,camera,THREE});view.setActive(true);const now=performance.now();view.updateFrame({visibleAgents:[{id:'far-target',x:100,z:0},{id:'other',x:-100,z:0}]},now);view.update(now);expect(view.getStats().far).toBe(2);const bounds={left:0,top:0,width:1200,height:600},v=new THREE.Vector3(100,1.1,0).project(camera),x=(v.x+1)*600,y=(1-v.y)*300;expect(view.pickScreen(x+8,y,bounds)?.personId).toBe('far-target');expect(view.pickScreen(x+14,y,bounds)).toBeNull();view.destroy();
});
test('new resident inspection reads the current paused worker without retroactive history replay',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');const runtime=createPopulationRuntime({config:{population:80,seed:19}});try{await runtime.ready;runtime.pause();await runtime.step();await runtime.step();const frame=runtime.getSnapshot(),id=frame.visibleAgents.at(-1).id,person=await runtime.inspectPerson(id);expect(runtime.getSnapshot().minute).toBe(60);expect(person.id).toBe(id);expect(person.history.actorTimeline.trackingStartedMinute).toBe(60);expect(person.history.actorTimeline.intervals).toHaveLength(0);}finally{runtime.destroy();}
},30000);
test('settled distant frames do not upload unchanged GPU buffers or commit detailed humans',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,2,.1,5000);camera.position.set(0,800,1000);const view=createPopulationRenderer({scene,camera,THREE}),now=performance.now();view.setActive(true);view.updateFrame({visibleAgents:Array.from({length:500},(_,i)=>({id:'p'+i,x:i-250,z:0}))},now);view.update(now);const points=scene.getObjectByName('living-worker-population').children.find(object=>object.isPoints),positionVersion=points.geometry.attributes.position.version,colorVersion=points.geometry.attributes.color.version;
 for(let i=1;i<=10;i++)view.update(now+i*20);expect(points.geometry.attributes.position.version).toBe(positionVersion);expect(points.geometry.attributes.color.version).toBe(colorVersion);expect(view.getStats()).toMatchObject({far:500,near:0,humanCommits:0});view.setSelected('p250');view.update(now+300);expect(view.getStats()).toMatchObject({near:1,far:499,selectedId:'p250'});const commits=view.getStats().humanCommits;view.update(now+400);expect(view.getStats().humanCommits).toBe(commits);view.destroy();
});
