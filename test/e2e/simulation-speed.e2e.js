import {test,expect} from '@playwright/test';
for(const renderer of ['webgl','canvas2d'])test(`${renderer}: normal World speed buttons, independent camera and pause/resume`,async({page})=>{
 test.setTimeout(90000);
 await page.route('**/api/area?*',r=>r.fulfill({json:{source:'none',buildings:[],roads:[],pois:[]}}));
 await page.route('**/api/overpass-health',r=>r.fulfill({json:{ok:false}}));
 await page.route(`**/world/${renderer==='canvas2d'?'canvas2d-world':'render'}.js`,async route=>{
  const response=await route.fetch();
  const probe=renderer==='canvas2d'?'({camera:[panX,panZ],minute:world.t,events:world.events.length})':'({camera:controls.target.toArray(),minute:world.t,events:world.events.length})';
  await route.fulfill({response,body:await response.text()+`\nwindow.__speedProbe=()=>${probe};`});
 });
 await page.goto(`/world?demo=1&people=30&seed=SHE-137-fixed-seed&renderer=${renderer}&quality=LOW`);
 await page.waitForFunction(()=>Boolean(window.hblSimulationPlayback)&&Boolean(window.hblWorldStartup?.readyMs)&&Boolean(window.__speedProbe),null,{timeout:60000});
 for(const speed of [.25,.5,1,2,4,8]){
  await page.locator(`#speeds [data-s="${speed}"]`).click();
  expect(await page.evaluate(()=>window.hblSimulationPlayback.getState().speed)).toBe(speed);
 }
 await page.locator('#speeds [data-s="0"]').click();
 const before=await page.evaluate(()=>window.hblSimulationPlayback.getState());
 await page.locator('#camera-speed').selectOption('8');
 await page.waitForTimeout(300);
 const after=await page.evaluate(()=>window.hblSimulationPlayback.getState());
 expect(after).toEqual(before);
 const paused=await page.evaluate(()=>window.__speedProbe());
 if(renderer==='webgl'){
  await page.locator('#camera-speed').blur();
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');
 }else{
  const canvas=page.locator('#canvas-lite-world'),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.6+50,box.y+box.height*.6+50);await page.mouse.up();
 }
 const moved=await page.evaluate(()=>window.__speedProbe());
 expect(moved.camera).not.toEqual(paused.camera);expect(moved.minute).toBe(paused.minute);expect(moved.events).toBe(paused.events);
 await page.locator('#speeds [data-s="0.25"]').click();
 await expect.poll(()=>page.evaluate(()=>window.hblSimulationPlayback.getState().simulationNow)).toBeGreaterThan(before.simulationNow);
 expect(await page.evaluate(()=>window.hblSimulationPlayback.getState().speed)).toBe(.25);
});
