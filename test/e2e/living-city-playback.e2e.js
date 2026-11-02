import {test,expect} from '@playwright/test';
async function observeActualWorld(page){
 await page.route('**/api/outcomes',r=>r.fulfill({json:{outcomes:[]}}));await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/world/render/people/human-renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nconst originalHumanFactory=createHumanInstances;createHumanInstances=function(options){const api=originalHumanFactory(options);(window.__actualHumanApis||=[]).push(api);return api;};`});});
 await page.route('**/world/render.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nconst hashPose=array=>{if(!array)return null;const numbers=Array.from(array);let hash=2166136261;const words=new Uint32Array(new Float32Array(numbers).buffer);for(const word of words)hash=Math.imul(hash^word,16777619);return hash>>>0;};window.__playbackProbe=()=>{const runtime=livingWorld?.getRuntime(),snapshot=runtime?.getSnapshot();return {minute:world.t,modelPositions:hashPose(world.people.flatMap(p=>[p.x,p.z])),legacyNeeds:hashPose(world.people.flatMap(p=>Object.values(p.needs))),displayPoses:(window.__actualHumanApis||[]).map(api=>api.parts.map(part=>hashPose(part.instanceMatrix.array))),traffic:Array.from({length:24},(_,i)=>cityRenderer.getVehicle?.(i)?.position||null),living:snapshot?{minute:snapshot.minute,tick:snapshot.runtime.tick,paused:snapshot.runtime.paused,positions:hashPose(snapshot.frame.positions),needs:hashPose(snapshot.visibleAgents.flatMap(p=>Object.values(p.needs||{})))}:null,cameraTarget:controls.target.toArray(),playback:playback.getState()};};`});});
}
test('pause freezes actual legacy poses and traffic while camera pans; GLB clothing uses shared materials and deterministic shirt colors',async({page})=>{
 test.setTimeout(150000);await observeActualWorld(page);const glbs=[];
 page.on('response',response=>{if(response.url().endsWith('/human-person.glb'))glbs.push(response.body());});
 await page.goto('/world?demo=1&people=40&renderer=webgl&quality=LOW');
 await page.waitForFunction(()=>Boolean(window.__playbackProbe)&&window.__actualHumanApis?.length&&window.__actualHumanApis.every(api=>api.assetStatus==='ready'),null,{timeout:90000});
 const bytes=(await Promise.all(glbs))[0];expect(bytes).toBeTruthy();expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
 const jsonLength=bytes.readUInt32LE(12),asset=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8').trim());
 expect(asset.meshes.map(m=>m.name)).toEqual(expect.arrayContaining(['TShirt','Pants','Skin','Hair','Shoes']));
 const human=await page.evaluate(async()=>{
  const {shirtColorFor}=await import('/world/render/people/human-renderer.js');
  return{apis:window.__actualHumanApis.map(api=>({status:api.assetStatus,parts:api.parts.map(p=>p.name),materials:new Set(api.parts.map(p=>p.material.uuid)).size,maxInstances:Math.max(...api.parts.map(p=>p.instanceMatrix.count)),shirtColors:new Set(Array.from(api.parts.find(p=>p.name==='TShirt').instanceColor.array).reduce((rows,_,i,a)=>{if(i%3===0)rows.push(a.slice(i,i+3).join(','));return rows;},[])).size})),deterministic:shirtColorFor('person-17')===shirtColorFor('person-17')};
 });
 expect(human.deterministic).toBe(true);for(const api of human.apis){expect(api.materials).toBe(5);expect(api.maxInstances).toBeLessThanOrEqual(500);expect(api.shirtColors).toBeGreaterThan(1);}
 await page.locator('#speeds [data-s="0"]').click();await page.waitForTimeout(250);
 const paused=await page.evaluate(()=>window.__playbackProbe());await page.waitForTimeout(700);const held=await page.evaluate(()=>window.__playbackProbe());
 expect(held.minute).toBe(paused.minute);expect(held.modelPositions).toBe(paused.modelPositions);expect(held.legacyNeeds).toBe(paused.legacyNeeds);expect(held.displayPoses).toEqual(paused.displayPoses);expect(held.traffic).toEqual(paused.traffic);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');const panned=await page.evaluate(()=>window.__playbackProbe());
 expect(panned.cameraTarget).not.toEqual(paused.cameraTarget);expect(panned.minute).toBe(paused.minute);expect(panned.modelPositions).toBe(paused.modelPositions);
 await page.locator('#speeds [data-s="1"]').click();await page.waitForTimeout(180);const resumed=await page.evaluate(()=>window.__playbackProbe());
 expect(resumed.playback.simulationNow-paused.playback.simulationNow).toBeLessThan(600);
 await expect.poll(()=>page.evaluate(()=>window.__playbackProbe().minute),{timeout:10000}).toBeGreaterThan(paused.minute);
 console.log('ACTUAL_GLB_PAUSE_PROOF',JSON.stringify({human,paused,held,resumed}));
});
