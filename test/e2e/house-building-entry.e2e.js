import {test,expect} from '@playwright/test';

test('clicking a mapped city home enters one of its actual households with the original OSM geometry',async({page})=>{
 test.setTimeout(120000);const records=new Map(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 // Keep real geometry, raycasting and simulation controllers; skip only the
 // expensive city GPU pass in this authority/navigation integration check.
 await page.route('**/world/render/renderer/webgpu-renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('return { renderer, mode:','renderer.render=()=>{}; return { renderer, mode:')});});
 const origin={lat:29.7286,lng:-95.4746},buildings=Array.from({length:15},(_,i)=>{const lat=origin.lat+Math.floor(i/5)*.00035,lng=origin.lng+i%5*.00035;return{id:'mapped-house-'+i,kind:'home',levels:2,name:'Mapped home '+i,pts:[[lat,lng],[lat+.00018,lng],[lat+.00018,lng+.00018],[lat,lng+.00018],[lat,lng]]};});
 await page.route(/\/api\/area(?:\?|$)/,route=>route.fulfill({json:{source:'osm',origin,radiusM:150,buildings,roads:[],pois:[],parks:[],water:[]}}));
 await page.route('**/api/outcomes',route=>route.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/api/world-experiments**',async route=>{const request=route.request(),id=new URL(request.url()).pathname.split('/')[3];if(request.method()==='POST'){const save=request.postDataJSON(),record={schemaVersion:'world-experiment-record.v1',id:'buildingqa01',url:'/world?experiment=buildingqa01',save};records.set(record.id,record);return route.fulfill({json:record,status:201});}return route.fulfill({json:records.get(id)??{experiments:[]}});});
 await page.goto('/world?living=1&people=20&seed=42&renderer=webgl&quality=LOW');await page.waitForFunction(()=>window.hblWorldStartup?.readyMs&&window.hblHouseEntry&&window.hblCaptureWorldExperiment&&window.hblLivingWorld?.getRuntime()?.getSnapshot());
 const target=await page.evaluate(async()=>{window.hblSimulationPlayback.pause();const {readPopulationCheckpoint}=await import('/world/population/checkpoint.js'),runtime=window.hblLivingWorld.getRuntime();await runtime.updateConfig({...runtime.getSnapshot().config,population:60,householdSize:4,seed:42});runtime.pause();const checkpoint=await runtime.exportCheckpoint(),model=readPopulationCheckpoint(checkpoint).model,homeId=model.locations[model.people.homeLocation[0]].id,building=window.hblLivingWorld.getContext().buildings.find(b=>b.id===homeId);window.hblCityRenderer.focusBuilding(homeId);return{homeId,building};});
 await page.waitForTimeout(650);
 const point=await page.evaluate(async building=>{const THREE=await import('/vendor/three/three.module.js'),save=await window.hblCaptureWorldExperiment(),camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,1,5000);camera.position.fromArray(save.view.camera.position);camera.lookAt(new THREE.Vector3().fromArray(save.view.camera.target));camera.updateMatrixWorld();const p=new THREE.Vector3(building.center[0],building.height*.5,building.center[1]).project(camera);return{x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};},target.building);
 await page.mouse.click(point.x,point.y);await expect(page.locator('#inspect #cityFocus')).toBeVisible();
 const enter=page.locator('#inspect .house-entry-controls button');await expect(enter).toBeEnabled();await enter.click();
 await expect(page.locator('[data-house-list]')).toHaveCount(0);
 await page.waitForURL(/\/world\/house\/.*\?experiment=buildingqa01/);await page.waitForFunction(()=>window.hblHouseSession?.getRuntime());
 const record=records.get('buildingqa01');expect(record.save.geometry.area.source).toBe('osm');expect(record.save.view.houseMode.buildingId).toBe(target.homeId);expect(record.save.view.houseMode.site.status).toBe('mapped');expect(record.save.geometry.area.buildings.find(b=>b.id===target.homeId)).toEqual(buildings.find(b=>b.id===target.homeId));
 const result=await page.evaluate(async()=>{const {readPopulationCheckpoint}=await import('/world/population/checkpoint.js'),session=window.hblHouseSession,state=readPopulationCheckpoint(await session.getCurrentCheckpoint()),h=await session.getRuntime().inspectHousehold(session.getHouseholdId());return{householdId:h.id,homeIds:h.members.map(id=>state.model.locations[state.model.people.homeLocation[Number(id.split('-p').at(-1))]].id)};});
 expect(result.homeIds.every(id=>id===target.homeId)).toBe(true);expect(errors).toEqual([]);
});
