import {test,expect} from '@playwright/test';
async function observeActualWorld(page){
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/world/render/people/human-renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nconst originalHumanFactory=createHumanInstances;createHumanInstances=function(options){const api=originalHumanFactory(options);(window.__actualHumanApis||=[]).push(api);return api;};`});});
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nconst hashPose=array=>{if(!array)return null;const numbers=Array.from(array);let hash=2166136261;const words=new Uint32Array(new Float32Array(numbers).buffer);for(const word of words)hash=Math.imul(hash^word,16777619);return hash>>>0;};window.__focusClothedPerson=()=>{for(let advanced=0;advanced<=180;advanced++){for(const [index,p]of world.people.entries()){if(p.mode!=='moving'&&!OUTDOOR.has(p.action))continue;const inside=(x,z,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};if(town.buildings.some(b=>b.kind!=='park'&&inside(p.x,p.z,b.poly)))continue;const target=new THREE.Vector3(p.x,1.2,p.z);for(let a=0;a<12;a++){const angle=a*Math.PI/6,from=new THREE.Vector3(p.x+Math.cos(angle)*12,6,p.z+Math.sin(angle)*12),distance=from.distanceTo(target),ray=new THREE.Raycaster(from,target.clone().sub(from).normalize(),0,distance);if(ray.intersectObjects(meshes,false).some(hit=>hit.distance<distance-.5))continue;smooth[index].x=p.x;smooth[index].z=p.z;camera.position.copy(from);controls.target.copy(target);controls.update();select({type:'person',id:index});return{index,minute:world.t,activity:p.doing,action:p.action,mode:p.mode,advanced};}}world.step(1);}throw new Error('No actual outdoor person with an unobstructed camera was found in 180 modeled minutes.');};window.__playbackProbe=()=>{const runtime=livingWorld?.getRuntime(),snapshot=runtime?.getSnapshot();return {minute:world.t,modelPositions:hashPose(world.people.flatMap(p=>[p.x,p.z])),legacyNeeds:hashPose(world.people.flatMap(p=>Object.values(p.needs))),displayPoses:(window.__actualHumanApis||[]).map(api=>api.parts.map(part=>hashPose(part.instanceMatrix.array))),traffic:Array.from({length:24},(_,i)=>cityRenderer.getVehicle?.(i)?.position||null),living:snapshot?{minute:snapshot.minute,tick:snapshot.runtime.tick,paused:snapshot.runtime.paused,positions:hashPose(snapshot.frame.positions),needs:hashPose(snapshot.visibleAgents.flatMap(p=>Object.values(p.needs||{})))}:null,cameraTarget:controls.target.toArray(),playback:playback.getState()};};`});});
}
test('pause freezes actual legacy poses and traffic while camera pans; GLB clothing uses shared materials and deterministic shirt colors',async({page})=>{
 test.setTimeout(150000);await observeActualWorld(page);const glbs=[];
 page.on('response',response=>{if(response.url().endsWith('/human-person.glb'))glbs.push(response.body());});
 await page.goto('/world?demo=1&people=40&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>Boolean(window.__playbackProbe)&&window.__actualHumanApis?.length&&window.__actualHumanApis.every(api=>api.assetStatus==='ready'),null,{timeout:90000});
 const bytes=(await Promise.all(glbs))[0];expect(bytes).toBeTruthy();expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
 const jsonLength=bytes.readUInt32LE(12),asset=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8').trim());
 expect(asset.nodes.filter(n=>Number.isInteger(n.mesh)).map(n=>n.name)).toEqual(expect.arrayContaining(['TShirt','Pants','Skin','Hair','Shoes']));
 const human=await page.evaluate(async()=>{
  const {shirtColorFor}=await import('/world/render/people/human-renderer.js');
  return{apis:window.__actualHumanApis.map(api=>({status:api.assetStatus,parts:api.parts.map(p=>p.name),materials:new Set(api.parts.map(p=>p.material.uuid)).size,maxInstances:Math.max(...api.parts.map(p=>p.instanceMatrix.count)),shirtColors:new Set(Array.from(api.parts.find(p=>p.name==='TShirt').instanceColor.array).reduce((rows,_,i,a)=>{if(i%3===0)rows.push(a.slice(i,i+3).join(','));return rows;},[])).size})),deterministic:shirtColorFor('person-17')===shirtColorFor('person-17')};
 });
 expect(human.deterministic).toBe(true);expect(human.apis.length).toBeGreaterThanOrEqual(2);expect(human.apis.some(api=>api.maxInstances<500)).toBe(true);for(const api of human.apis){expect(api.materials).toBe(5);expect(api.maxInstances).toBeLessThanOrEqual(500);expect(api.shirtColors).toBeGreaterThan(1);}
 await page.locator('#speeds [data-s="0"]').click();await page.waitForTimeout(250);
 const paused=await page.evaluate(()=>window.__playbackProbe());await page.waitForTimeout(700);const held=await page.evaluate(()=>window.__playbackProbe());
 expect(held.minute).toBe(paused.minute);expect(held.modelPositions).toBe(paused.modelPositions);expect(held.legacyNeeds).toBe(paused.legacyNeeds);expect(held.displayPoses).toEqual(paused.displayPoses);expect(held.traffic).toEqual(paused.traffic);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');const panned=await page.evaluate(()=>window.__playbackProbe());
 expect(panned.cameraTarget).not.toEqual(paused.cameraTarget);expect(panned.minute).toBe(paused.minute);expect(panned.modelPositions).toBe(paused.modelPositions);
 const resumeStarted=await page.evaluate(()=>performance.now());await page.locator('#speeds [data-s="1"]').click();await page.waitForTimeout(180);const resumed=await page.evaluate(()=>({...window.__playbackProbe(),observedRealNow:performance.now()}));
 expect(resumed.playback.simulationNow-paused.playback.simulationNow).toBeLessThanOrEqual(resumed.observedRealNow-resumeStarted+1);
 await expect.poll(()=>page.evaluate(()=>window.__playbackProbe().minute),{timeout:10000}).toBeGreaterThan(paused.minute);
 await page.locator('#speeds [data-s="0"]').click();const outdoor=await page.evaluate(()=>window.__focusClothedPerson());expect(outdoor.mode==='moving'||['play_park','clean_park'].includes(outdoor.action)).toBeTruthy();await page.waitForTimeout(300);
 await expect(page.locator('#inspect [data-person-needs]')).toBeVisible();
 await page.screenshot({path:'/private/tmp/hbl-clothed-person-needs.png'});
 console.log('ACTUAL_GLB_PAUSE_PROOF',JSON.stringify({human,pausedMinute:paused.minute,heldMinute:held.minute,posedHashesFrozen:JSON.stringify(paused.displayPoses)===JSON.stringify(held.displayPoses),trafficFrozen:JSON.stringify(paused.traffic)===JSON.stringify(held.traffic),resumeDelta:resumed.playback.simulationNow-paused.playback.simulationNow,outdoor}));
});

test('10k population button and all canonical sliders drive actual runtime while main pause stays authoritative',async({page})=>{
 test.setTimeout(180000);await observeActualWorld(page);
 await page.goto('/world?demo=1&people=30&seed=42&renderer=webgl&quality=LOW&business_mode=true');
 await page.waitForFunction(()=>Boolean(window.__playbackProbe),null,{timeout:60000});
 await page.locator('#speeds [data-s="0"]').click();
 const add=page.getByTestId('add-population');await expect(add).toHaveText('Simulate 10,000 people');await add.click();
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime()?.getSnapshot()?.config.population),{timeout:60000}).toBe(10000);
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().runtime.paused),{timeout:15000}).toBe(true);
 await expect(add).toHaveText('+10,000 people');await add.click();
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot()?.config.population),{timeout:60000}).toBe(20000);
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().runtime.paused)).toBe(true);
 expect(await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().visibleAgents.length)).toBeLessThanOrEqual(500);
 expect(await page.evaluate(()=>window.hblLivingWorld.getRenderStats().limit)).toBe(500);
 await page.getByTestId('open-population-parameters').click();const studio=page.getByTestId('population-studio');
 const ids=await page.evaluate(async()=>{const {populationParameters}=await import('/world/population/contracts.js');return populationParameters.map(p=>p.id);});
 await expect(studio.locator('[data-population-slider]')).toHaveCount(ids.length);await expect(studio.locator('[data-population-parameter]')).toHaveCount(ids.length);
 expect(await studio.locator("[data-population-slider]").evaluateAll(nodes=>nodes.map(n=>n.dataset.populationSlider).sort())).toEqual([...ids].sort());expect(await studio.locator("[data-population-parameter]").evaluateAll(nodes=>nodes.map(n=>n.dataset.populationParameter).sort())).toEqual([...ids].sort());
 const before=await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().metrics.meanHousingBurden);
 const slider=studio.locator('[data-population-slider="rentMultiplier"]');await slider.evaluate(node=>{for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
 await slider.scrollIntoViewIfNeeded();await slider.focus();await slider.press('End');const chosen=Number(await slider.inputValue());
 expect(chosen).toBeGreaterThan(1);
 await expect.poll(()=>page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot()?.config.rentMultiplier),{timeout:30000}).toBe(chosen);
 await expect(studio.locator('[data-population-parameter="rentMultiplier"]')).toHaveValue(String(chosen));
 expect(await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().metrics.meanHousingBurden)).toBeGreaterThan(before*1.1);
 await expect(studio.locator('[data-ps-comparison-note]')).toContainText('Actual paired behavior preview',{timeout:60000});
 await studio.locator('[data-ps-metric]').selectOption('meanHousingBurden');await expect(studio.locator('[data-ps-chart] polyline')).toHaveCount(2);
 const number=studio.locator('[data-population-parameter="rentMultiplier"]');await number.evaluate(node=>{for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await number.scrollIntoViewIfNeeded();await number.fill('999');await expect(number).toHaveAttribute('aria-invalid','true');
 await page.waitForTimeout(300);expect(await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().config.rentMultiplier)).toBe(chosen);
 const revisionBeforeRestore=await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().runtime.revision);await number.fill(String(chosen));await expect(number).not.toHaveAttribute('aria-invalid','true');await page.waitForTimeout(350);expect(await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().runtime.revision)).toBe(revisionBeforeRestore);await expect(studio.locator('[data-ps-chart] polyline')).toHaveCount(2);
 await page.locator('#speeds [data-s="0"]').click();await page.waitForTimeout(300);const paused=await page.evaluate(()=>window.__playbackProbe());await page.waitForTimeout(600);const held=await page.evaluate(()=>window.__playbackProbe());
 expect(held.living).toEqual(paused.living);expect(held.displayPoses).toEqual(paused.displayPoses);expect(held.traffic).toEqual(paused.traffic);
 await page.locator('#speeds [data-s="1"]').click();const startMinute=held.living.minute;await expect.poll(()=>page.evaluate(()=>window.__playbackProbe().living.minute),{timeout:10000}).toBeGreaterThan(startMinute);const advanced=await page.evaluate(()=>window.__playbackProbe());expect(advanced.living.minute-startMinute).toBeLessThanOrEqual(10);await page.locator('#speeds [data-s="0"]').click();
 await studio.locator('[data-ps-chart]').scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/hbl-population-sliders-20000.png'});
 console.log('ACTUAL_POPULATION_BUTTON_AND_SLIDERS',JSON.stringify({population:20000,canonicalSliders:ids.length,rentMultiplier:chosen,beforeBurden:before,pausedLiving:held.living,sampleLimit:500}));
});

test('restoring the applied numeric value uses a real input event and preserves actual worker revision and comparison',async({page})=>{
 await page.route('**/__living-restore-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));await page.goto('/__living-restore-test');
 await page.evaluate(async()=>{const {createPopulationRuntime}=await import('/world/population/runtime.js'),{defaultPopulationConfig}=await import('/world/population/contracts.js'),{mountPopulationStudio}=await import('/world/population/studio.js');window.runtime=createPopulationRuntime({config:{...defaultPopulationConfig,population:240,seed:42}});await window.runtime.ready;window.runtime.pause();window.studio=mountPopulationStudio({container:document.querySelector('main'),runtime:window.runtime});});
 const studio=page.getByTestId('population-studio'),number=studio.locator('[data-population-parameter="rentMultiplier"]');
 await number.evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await number.fill('1.5');
 await expect(studio.locator('[data-ps-comparison-note]')).toContainText('Actual paired behavior preview',{timeout:30000});await expect(studio.locator('[data-ps-chart] polyline')).toHaveCount(2);
 const before=await page.evaluate(()=>({revision:window.runtime.getSnapshot().runtime.revision,metrics:window.runtime.getSnapshot().metrics,paths:[...document.querySelectorAll('[data-ps-chart] polyline')].map(n=>n.getAttribute('points'))}));
 await number.evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await number.fill('999');await expect(number).toHaveAttribute('aria-invalid','true');await number.fill('1.5');await expect(number).not.toHaveAttribute('aria-invalid','true');await page.waitForTimeout(350);
 const after=await page.evaluate(()=>({revision:window.runtime.getSnapshot().runtime.revision,metrics:window.runtime.getSnapshot().metrics,paths:[...document.querySelectorAll('[data-ps-chart] polyline')].map(n=>n.getAttribute('points'))}));expect(after).toEqual(before);
 await page.evaluate(()=>{window.studio.destroy();window.runtime.destroy();});
});
