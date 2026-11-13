import {test,expect} from 'bun:test';
import {simulationLighting,windowFraction,legacyHomeCounts} from '../world/render/environment/sim-lighting.js';
import {createPopulationModel,snapshotPopulation,serializePopulation,restorePopulation,stepPopulation,buildingHomeCounts} from '../world/population/model.js';
import {personAtHome} from '../world/house/model.js';
const context={buildings:Array.from({length:20},(_,i)=>({id:'b'+i,center:[i*100,i%3*200],kind:i%2?'home':'work'}))};
test('solar phases, midnight, manual overrides and Sunday tint are deterministic',()=>{
 const night=simulationLighting(120),dawn=simulationLighting(360),noon=simulationLighting(780),dusk=simulationLighting(1170);
 expect(night.daylight).toBe(0);expect(night.lamps).toBe(1);expect(noon.daylight).toBe(1);expect(noon.lamps).toBe(0);expect(dawn.twilight).toBe(1);expect(dusk.twilight).toBe(1);
 expect(new Set([night.skyColor,dawn.skyColor,noon.skyColor,dusk.skyColor]).size).toBe(4);
 expect(simulationLighting(1440).skyColor).toBe(simulationLighting(0).skyColor);
 expect(simulationLighting(6*1440+540).skyColor).not.toBe(simulationLighting(540).skyColor);
 expect(simulationLighting(120,14).daylight).toBeGreaterThan(.9);
});
test('windows use exact home ratios, office closure and missing data stays dark',()=>{
 expect(windowFraction({kind:'home'},{residents:4,atHome:1},99,22,0)).toBe(.25);
 expect(windowFraction({kind:'home'},{residents:4,atHome:0},99,22,0)).toBe(0);
 expect(windowFraction({kind:'office'},null,10,22,0)).toBe(0);
 expect(windowFraction({kind:'office'},{residents:4,atHome:4},10,22,0)).toBe(0);
 expect(windowFraction({kind:'work'},null,10,10,6)).toBe(0);
 expect(windowFraction({kind:'work'},null,10,10,0)).toBe(1);
 expect(windowFraction({kind:'home'},null,0,22,0)).toBe(0);
 const buildings=[{id:'a'},{id:'b'}];expect(legacyHomeCounts([{home:0,target:0,mode:'doing'},{home:0,target:1,mode:'doing'},{home:0,target:0,mode:'moving'}],buildings)[0]).toEqual({buildingId:'a',residents:3,atHome:1});
});
test('full-model home counts match House presence regardless of sample, travel/visit and replay',()=>{
 const m=createPopulationModel({population:100,seed:262},context);const p=m.people;
 // Force meaningful absence paths using real assigned identities.
 p.remaining[0]=10;m.visits={active:{1:{}}};p.x[2]+=10;
 const before=serializePopulation(m),all=snapshotPopulation(m,{visibleLimit:100}),none=snapshotPopulation(m,{visibleLimit:0});
 expect(none.buildingHomeCounts).toEqual(all.buildingHomeCounts);expect(serializePopulation(m)).toEqual(before);
 for(const row of none.buildingHomeCounts){const ids=Array.from({length:p.age.length},(_,i)=>i).filter(i=>String(m.locations[p.homeLocation[i]]?.id)===row.buildingId);expect(row.residents).toBe(ids.length);expect(row.atHome).toBe(ids.filter(i=>personAtHome(m,i)).length);}
 // Restore a normal model, then verify seed-matched step and checkpoint views.
 const a=createPopulationModel({population:100,seed:262},context),b=restorePopulation(serializePopulation(a));
 stepPopulation(a,{minutes:600});stepPopulation(b,{minutes:600});expect(buildingHomeCounts(a)).toEqual(buildingHomeCounts(b));expect(buildingHomeCounts(restorePopulation(serializePopulation(a)))).toEqual(buildingHomeCounts(a));
});

test('live worker/runtime carries full home counts through step and checkpoint entry points',async()=>{
 const {createPopulationRuntime}=await import('../world/population/runtime.js');
 const runtime=createPopulationRuntime({config:{population:100,seed:262},worldContext:context,initialMinute:360,stepMinutes:1,clockMode:'minutes-per-second'});
 try{await runtime.ready;let s=runtime.getSnapshot();expect(s.buildingHomeCounts.reduce((n,r)=>n+r.residents,0)).toBe(100);expect(s.minute).toBe(360);await runtime.step();s=runtime.getSnapshot();const checkpoint=await runtime.exportCheckpoint();await runtime.restoreCheckpoint(checkpoint);expect(runtime.getSnapshot().buildingHomeCounts).toEqual(s.buildingHomeCounts);expect(runtime.getSnapshot().minute).toBe(s.minute);expect(runtime.getSnapshot().runtime.paused).toBe(true);}finally{runtime.destroy();}
},30000);

test('street lamps and moving headlights turn on at dusk and honor traffic visibility',async()=>{
 const THREE=await import('three'),{createCityDetails}=await import('../world/render/environment/city-details.js');
 const scene=new THREE.Scene(),details=createCityDetails(scene,{roads:[{pts:[[0,0],[100,0]]}],buildings:[]}),camera=new THREE.PerspectiveCamera();
 try{const lamps=details.groups.props.filter(m=>m.material.emissive.getHex()===0xffd38b),headlights=scene.getObjectByName('dusk-headlights');expect(lamps.length).toBeGreaterThan(0);
 details.update(0,.016,camera,{density:1},{},{lighting:simulationLighting(780)});expect(lamps[0].material.emissiveIntensity).toBe(0);expect(headlights.visible).toBe(false);
 details.update(1000,.016,camera,{density:1},{},{lighting:simulationLighting(1320)});expect(lamps[0].material.emissiveIntensity).toBe(1.4);expect(headlights.visible).toBe(true);expect(headlights.count).toBe(details.vehicleCount*2);
 const pose=headlights.instanceMatrix.array.slice();details.update(2000,.016,camera,{density:1},{},{lighting:simulationLighting(1320)});expect(headlights.instanceMatrix.array).not.toEqual(pose);
 details.update(3000,.016,camera,{density:1},{traffic:false},{lighting:simulationLighting(1320)});expect(headlights.visible).toBe(false);
 }finally{details.dispose();}expect(scene.children).toHaveLength(0);
});
