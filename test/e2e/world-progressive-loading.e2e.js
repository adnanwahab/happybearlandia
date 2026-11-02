import {test,expect} from '@playwright/test';

// The clocks below observe real WebGL calls and completed geometry jobs. They
// do not substitute a renderer or count DOM canvas insertion as a first frame.
async function instrument(page,geometryDelay=40) {
  page.on('pageerror',error=>console.log('WORLD_STARTUP_PAGE_ERROR',error.message));
  await page.addInitScript(()=>{
    window.__startupProbe={draw:null,jobs:[],longTasks:[],progress:[]};
    const sample=()=>{const p=window.hblWorldStartup?.geometry;if(p){const last=window.__startupProbe.progress.at(-1);if(!last||last.attached!==p.attached)window.__startupProbe.progress.push({at:performance.now(),attached:p.attached,total:p.total,status:p.status});}requestAnimationFrame(sample);};requestAnimationFrame(sample);
    try {new PerformanceObserver(list=>{for(const e of list.getEntries())window.__startupProbe.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch{}
    for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]) {
      if(!type)continue;
      for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
        const original=type.prototype[key];if(!original)continue;
        type.prototype[key]=function(...args){const result=original.apply(this,args);window.__startupProbe.draw??=performance.now();return result;};
      }
    }
  });
  await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__visibleContext=()=>{camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));let inFrustum=0,inOpenView=0;scene.traverse(mesh=>{const b=mesh.userData.contextBuilding;if(!b||!mesh.visible||!frustum.intersectsObject(mesh))return;inFrustum++;const p=new THREE.Vector3(b.center[0],b.height/2,b.center[1]).project(camera),x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;if(x>350&&x<innerWidth-440&&y>60&&y<innerHeight-130&&p.z>-1&&p.z<1)inOpenView++;});const tiles=mapStreamer.getState().tiles;return {inFrustum,inOpenView,localScreenWidth:2*camera.position.distanceTo(controls.target)*Math.tan(camera.getEffectiveFOV()*Math.PI/360)*camera.aspect,target:{x:controls.target.x,z:controls.target.z},covered:tiles.some(t=>['ready','building','resident'].includes(t.status)&&(()=>{const b=t.actualBounds||t.bounds;return controls.target.x>=b.minX&&controls.target.x<=b.maxX&&controls.target.z>=b.minZ&&controls.target.z<=b.maxZ;})())};};\nwindow.__projectActualVehicle=(id)=>{const vehicle=cityRenderer.getVehicle(id);if(!vehicle?.active)return null;const p=new THREE.Vector3(vehicle.position.x,vehicle.position.y,vehicle.position.z).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,z:p.z};};`});});
  await page.route('**/render/geometry/geometry-cache.js',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`\nconst originalBuilding=GeometryCache.prototype.building;
GeometryCache.prototype.building=async function(...args){
 await new Promise(resolve=>setTimeout(resolve,${geometryDelay}));
 window.__startupProbe.cache={pending:this.pending.size,bytes:this.bytes};
 const result=await originalBuilding.apply(this,args);
 window.__startupProbe.cache={pending:this.pending.size,bytes:this.bytes};
 window.__startupProbe.jobs.push({id:args[0].id,at:performance.now()});return result;
};`});
  });
  await page.route('**/api/area/enrichment?*',async route=>{await new Promise(r=>setTimeout(r,2000));await route.fulfill({json:{areaKey:'fixture-core',floodZones:[],floodZonesSource:'unavailable',floodZonesStatus:'error',floodZonesError:'Controlled unavailable overlay'}});});
  await page.route('**/api/outcomes',route=>route.fulfill({json:{outcomes:[]}}));
  await page.route('**/api/overpass-health',route=>route.fulfill({json:{ok:true}}));
}

const area={source:'osm',radiusM:250,origin:{lat:29.7286,lng:-95.4746},areaKey:'fixture-core',enrichment:{url:'/api/area/enrichment?fixture=1',key:'fixture-core',status:'pending'},attribution:'Controlled local browser fixture',buildings:Array.from({length:36},(_,i)=>{
  const lat=29.728+(i%6)*.00035,lng=-95.475+Math.floor(i/6)*.00035;
  const pts=[[lat,lng],[lat+.00015,lng],[lat+.00015,lng+.00015],[lat,lng+.00015],[lat,lng]];
  return {id:`fixture-${i}`,kind:i%5===0?'work':'home',levels:2,pts};
}),roads:[],places:[]};

test('slow map and geometry produce an interactive frame before all buildings finish',async({page},testInfo)=>{
  await instrument(page);
  await page.route('**/api/area?*',async route=>{await new Promise(r=>setTimeout(r,800));await route.fulfill({json:area});});
  await page.goto('/world?people=20&renderer=webgl&quality=LOW&business_mode=true');
  await expect.poll(()=>page.evaluate(()=>window.__startupProbe.draw),{timeout:60000}).not.toBeNull();
  const atFirstDraw=await page.evaluate(()=>structuredClone(window.__startupProbe));
  // Controls must work while geometry is pending, rather than after startup.
  await page.locator('#latlng').fill('29.7286');
  await expect(page.locator('#latlng')).toHaveValue('29.7286');
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblCityRenderer)),{timeout:60000}).toBe(true);
  // Allow a quiet window after the initial population finishes. Detail upgrades
  // may issue repeated jobs, so count unique building IDs rather than jobs.
  await expect.poll(()=>page.evaluate(()=>new Set(window.__startupProbe.jobs.map(j=>j.id)).size),{timeout:60000}).toBeGreaterThanOrEqual(36);
  await expect.poll(()=>page.evaluate(()=>window.hblWorldStartup?.geometry?.status || 'completed'),{timeout:60000}).toBe('completed');
  await page.waitForTimeout(500);
  const probe=await page.evaluate(()=>structuredClone(window.__startupProbe));
  const unique=[...new Map(probe.jobs.map(j=>[j.id,j])).values()];
  const report={firstFrameMs:probe.draw,firstBuildingMs:probe.jobs[0]?.at,fullGeometryMs:Math.max(...unique.map(j=>j.at)),uniqueBuildings:unique.length,buildingsAtFirstDraw:new Set(atFirstDraw.jobs.map(j=>j.id)).size,longTasks:probe.longTasks,attachmentFrames:probe.progress};
  console.log('WORLD_STARTUP_MEASUREMENTS',JSON.stringify(report));
  await testInfo.attach('startup-measurements',{body:JSON.stringify(report,null,2),contentType:'application/json'});
  expect(new URL(page.url()).searchParams.get('business_mode')).toBe('true');
  if(!process.env.HBL_STARTUP_BASELINE){
    expect(probe.progress.length).toBeGreaterThan(1);
    expect(probe.progress.at(-1).attached).toBe(probe.progress.at(-1).total);
    expect(report.uniqueBuildings).toBe(37);
    expect(report.firstFrameMs).toBeLessThan(report.fullGeometryMs);
    expect(report.buildingsAtFirstDraw).toBeLessThan(report.uniqueBuildings);
  }
});

for(const failure of ['http','abort'])test(`map ${failure} settles into a rendered fallback`,async({page})=>{
  await instrument(page,0);
  await page.route('**/api/area?*',route=>failure==='abort'?route.abort('failed'):route.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/world?people=10&renderer=webgl&quality=LOW&business_mode=true');
  await expect.poll(()=>page.evaluate(()=>window.__startupProbe.draw),{timeout:60000}).not.toBeNull();
  await expect(page.locator('#source')).toContainText('procedural');
  try {
    if(process.env.HBL_STARTUP_DIAG)await expect(page.locator('#loading')).toHaveCount(0,{timeout:60000});
    else {
      await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs)),{timeout:30000}).toBe(true);
      const before=await page.evaluate(()=>window.hblWorldStartup.geometry.attached);
      await expect.poll(()=>page.evaluate(before=>{const p=window.hblWorldStartup.geometry;return p.status==='completed'||p.attached>before;},before),{timeout:15000}).toBe(true);
      expect(await page.evaluate(()=>window.hblWorldStartup.geometry.failed)).toBe(0);
      await page.locator('#latlng').fill('29.7286, -95.4746');
      await expect(page.locator('#latlng')).toHaveValue('29.7286, -95.4746');
    }
  }
  finally {console.log('WORLD_RECOVERY_STATE',failure,JSON.stringify(await page.evaluate(()=>({startup:window.hblWorldStartup,cache:window.__startupProbe.cache,renderer:window.hblCityRenderer?.getPerformanceStats(),probe:{draw:window.__startupProbe.draw,jobCount:window.__startupProbe.jobs.length,uniqueJobs:new Set(window.__startupProbe.jobs.map(j=>j.id)).size,lastJobs:window.__startupProbe.jobs.slice(-8),progress:window.__startupProbe.progress.slice(-8),longTaskCount:window.__startupProbe.longTasks.length,lastLongTasks:window.__startupProbe.longTasks.slice(-8)},now:performance.now(),loading:document.querySelector('#loading')?.textContent}))));}
  expect(new URL(page.url()).searchParams.get('business_mode')).toBe('true');
});

test('local arrows, minimap and measured FPS remain usable without URL navigation',async({page})=>{
  await instrument(page,0);
  const trafficRoads=[{kind:'residential',pts:[[29.7278,-95.476],[29.7278,-95.4725]]},{kind:'residential',pts:[[29.7282,-95.476],[29.7282,-95.4725]]}];
  const requests=[];
  await page.route('**/api/area?*',async route=>{
    const url=new URL(route.request().url()),lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));requests.push(url.href);
    const latShift=lat-area.origin.lat,lngShift=lng-area.origin.lng,key=`${lat.toFixed(6)}:${lng.toFixed(6)}`;
    await new Promise(r=>setTimeout(r,100));
    await route.fulfill({json:{...area,areaKey:key,origin:{lat,lng},roads:trafficRoads.map(r=>({...r,pts:r.pts.map(([a,c])=>[a+latShift,c+lngShift])})),buildings:area.buildings.map(b=>({...b,id:`${key}:${b.id}`,pts:b.pts.map(([a,c])=>[a+latShift,c+lngShift])}))}});
  });
  await page.goto('/world?people=20&renderer=webgl&quality=LOW&business_mode=true');
  const minimap=page.getByTestId('world-minimap');
  await expect(minimap).toBeVisible({timeout:60000});
  const position=minimap.locator('[data-mm-position]');
  await expect(position).not.toHaveText('');
  await expect.poll(()=>page.getByTestId('world-fps-meter').getAttribute('data-fps').then(Number),{timeout:30000}).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>Boolean(window.hblWorldStartup?.readyMs)),{timeout:60000}).toBe(true);
  // Click projected positions from real instanced-traffic metadata. Occluded
  // cars may lose to a closer building, so try other actual instances.
  const cabin=page.getByTestId('vehicle-inspector');
  for(let id=0;id<32&&!await cabin.isVisible();id++){
    const point=await page.evaluate(id=>window.__projectActualVehicle?.(id),id);
    if(point&&point.z>-1&&point.z<1&&point.x>320&&point.x<1200&&point.y>100&&point.y<760)await page.mouse.click(point.x,point.y);

  }
  await expect(cabin).toBeVisible();
  await expect(cabin).toContainText('decorative traffic');
  await expect(cabin.locator('svg')).toBeVisible();
  await page.screenshot({path:'/private/tmp/hbl-world-car-interior.png'});
  await cabin.getByRole('button',{name:'Close car interior'}).click();
  const initialURL=page.url(),before=await position.textContent();
  await page.locator('#latlng').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  expect(await position.textContent()).toBe(before);
  await page.locator('#latlng').blur();
  const beforeKeyboard={requests:requests.length,keys:await page.evaluate(()=>window.hblMapStreamer.getState().tiles.map(t=>t.key))};
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(1500);await page.keyboard.up('ArrowRight');
  await expect(position).not.toHaveText(before);
  await expect.poll(()=>requests.length,{timeout:30000}).toBeGreaterThan(1);
  await expect.poll(()=>requests.length,{timeout:30000}).toBeGreaterThan(beforeKeyboard.requests);
  await expect.poll(()=>page.evaluate(keys=>window.hblMapStreamer.getState().tiles.some(t=>!keys.includes(t.key)&&(t.progress?.attached||0)>0),beforeKeyboard.keys),{timeout:30000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__visibleContext().covered),{timeout:30000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__visibleContext().inOpenView),{timeout:30000}).toBeGreaterThan(0);
  console.log('KEYBOARD_VISIBLE_CONTEXT',JSON.stringify(await page.evaluate(()=>window.__visibleContext())));
  console.log('KEYBOARD_STREAM_STATE',JSON.stringify(await page.evaluate(()=>window.hblMapStreamer.getState())));
  const moved=await position.textContent();
  await minimap.locator('canvas').click({position:{x:70,y:70}});
  await expect(position).not.toHaveText(moved);
  expect(page.url()).toBe(initialURL);
  const fps=page.getByTestId('world-fps-meter');
  await expect.poll(()=>fps.getAttribute('data-fps').then(Number),{timeout:30000}).toBeGreaterThan(0);
  // Screen buttons belong to the same local camera, including repeated presses.
  const east=page.getByRole('button',{name:'Pan east one current screen',exact:true});
  await expect(east).toBeVisible();
  const stepBefore=await page.evaluate(()=>window.__visibleContext());
  await east.click();
  const stepAfter=await page.evaluate(()=>window.__visibleContext());
  expect(Math.abs((stepAfter.target.x-stepBefore.target.x)-stepBefore.localScreenWidth)/stepBefore.localScreenWidth).toBeLessThan(.1);
  for(let i=0;i<2;i++)await east.click();
  await expect.poll(()=>requests.length,{timeout:30000}).toBeGreaterThan(1);
  await expect.poll(()=>page.evaluate(()=>window.hblMapStreamer?.getState().tileCount??Infinity)).toBeLessThanOrEqual(9);
  const stream=await page.evaluate(()=>window.hblMapStreamer.getState());
  expect(stream.contextOnly).toBe(true);expect(stream.residentTileKey).toBe('0:0');
  expect(new Set(stream.tiles.map(t=>t.key)).size).toBe(stream.tiles.length);
  await expect.poll(()=>page.evaluate(()=>window.__visibleContext().covered),{timeout:30000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__visibleContext().inOpenView),{timeout:30000}).toBeGreaterThan(0);
  console.log('SCREEN_PAN_VISIBLE_CONTEXT',JSON.stringify(await page.evaluate(()=>window.__visibleContext())));
  await page.screenshot({path:'/private/tmp/hbl-world-keyboard-streaming.png'});
  expect(page.url()).toBe(initialURL);
  expect(new URL(page.url()).searchParams.get('business_mode')).toBe('true');
});
