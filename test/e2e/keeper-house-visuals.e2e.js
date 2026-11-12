import {test,expect} from '@playwright/test';
test('main house displays saved carried possessions and creatures with working scene labels',async({page})=>{
 await page.setViewportSize({width:1400,height:1000});
 await page.route('**/keeper-scene-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><main style="height:1000px"></main></body></html>'}));
 await page.goto('/keeper-scene-fixture');await page.evaluate(async()=>{
  const {mountHouseRenderer}=await import('/world/house/house-renderer.js');
  window.expansionClicks=[];document.addEventListener('hbl-household-expansion',event=>expansionClicks.push(event.detail));window.scene=mountHouseRenderer(document.querySelector('main'));
  window.person={id:'synthetic-fixture-p0',name:'Ama',ageYears:30,atHome:true,roomId:'living'};
  window.view={paused:true,members:[person],home:{rooms:[{id:'bedroom',label:'Bedroom',capacity:3,noise:.2,light:.7,cleanliness:.7,privacy:.7},{id:'kitchen',label:'Kitchen',capacity:3,noise:.2,light:.7,cleanliness:.7,privacy:.7},{id:'living',label:'Living',capacity:3,noise:.2,light:.7,cleanliness:.7,privacy:.7},{id:'study',label:'Study',capacity:3,noise:.2,light:.7,cleanliness:.7,privacy:.7}],objects:[],actions:[],systems:{'household-work':{props:[{id:'real-sandwich',kind:'sandwich',label:'Packed sandwich',roomId:'living',carrierId:'synthetic-fixture-p0'}]},'creature-keeper':{creatures:[{id:'real-goblin',kind:'dustgoblin',name:'Mote',roomId:'living',stage:'juvenile',magic:0},{id:'real-guardian',kind:'guardian',name:'Bramble',roomId:'living',stage:'hatchling',magic:20}]}}}};
  scene.update(view,{selectedPersonId:'synthetic-fixture-p0'});await scene.ready;
 });
 await expect.poll(()=>page.evaluate(()=>scene.getExpansionDebug().filter(row=>row.visible).map(row=>row.id).sort())).toEqual(['real-goblin','real-guardian','real-sandwich']);
 const sandwich=await page.evaluate(()=>scene.getExpansionDebug().find(row=>row.id==='real-sandwich'));
 expect(sandwich.carrierId).toBe('synthetic-fixture-p0');expect(sandwich.position.y).toBeGreaterThan(.3);
 await page.locator('[data-house-expansion="real-goblin"]').click();
 expect(await page.evaluate(()=>expansionClicks.at(-1))).toEqual({system:'creature-keeper',creatureId:'real-goblin'});
 await page.locator('[data-house-expansion="real-sandwich"]').click();
 expect(await page.evaluate(()=>expansionClicks.at(-1))).toEqual({system:'household-work',objectId:'real-sandwich'});
 await page.evaluate(()=>{person.atHome=false;scene.update(view);});
 await expect.poll(()=>page.evaluate(()=>scene.getExpansionDebug().find(row=>row.id==='real-sandwich').visible)).toBe(false);
 await expect(page.locator('[data-house-expansion="real-sandwich"]')).toBeHidden();
 await expect(page.locator('[data-house-expansion="real-goblin"]')).toBeVisible();
});
