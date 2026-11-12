import {test,expect} from '@playwright/test';
test('keyboard bounds and city brush query authoritative worker population',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/selection-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body><nav></nav><canvas width="600" height="400" style="width:600px;height:400px"></canvas><main></main></body>'}));
 await page.goto('/selection-fixture');
 await page.evaluate(async()=>{
  const {createPopulationRuntime}=await import('/world/population/runtime.js'),{mountNeighborhoodSelection}=await import('/world/population/neighborhood-selection-ui.js');
  window.selectionRuntime=createPopulationRuntime({config:{population:600,seed:42}});await selectionRuntime.ready;selectionRuntime.pause();await selectionRuntime.step();
  // Ray projection fixture isolates pointer ownership from GPU availability.
  class Vector {constructor(x,y,z){Object.assign(this,{x,y,z});}}
  class Raycaster {setFromCamera(v){this.ray={intersectPlane:()=>({x:v.x*100,z:v.y*100})};}}
  window.selectionControls={enabled:true};window.selectionUI=mountNeighborhoodSelection({container:document.querySelector('main'),toolbar:document.querySelector('nav'),canvas:document.querySelector('canvas'),camera:{},controls:selectionControls,THREE:{Vector2:Vector,Vector3:Vector,Plane:class{},Raycaster},getRuntime:()=>selectionRuntime,isActive:()=>true});
 });
 await page.getByRole('button',{name:'Inspect neighborhood',exact:true}).click();const panel=page.getByRole('dialog',{name:'Neighborhood population'});
 for(const key of ['minX','minZ'])await panel.getByLabel(key,{exact:true}).fill('-1000000');for(const key of ['maxX','maxZ'])await panel.getByLabel(key,{exact:true}).fill('1000000');
 await panel.getByRole('button',{name:'Select neighborhood',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(panel.getByRole('status')).toContainText('Simulated agents: 600');await expect(panel.getByRole('status')).toContainText('Current interactions: Unavailable');await expect(panel.getByRole('status')).toContainText('Aggregate-only persons: 0');
 const tick=await page.evaluate(()=>selectionRuntime.getSnapshot().runtime.tick);
 await panel.getByRole('button',{name:'Close neighborhood inspector'}).click();
 const box=await page.locator('canvas').boundingBox();await page.keyboard.down('Shift');await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+150,box.y+120);expect(await page.evaluate(()=>selectionControls.enabled)).toBe(false);await page.mouse.up();await page.keyboard.up('Shift');
 await expect(panel).toBeVisible();await expect(panel.getByRole('status')).toContainText('Tick '+tick);expect(await page.evaluate(()=>selectionControls.enabled)).toBe(true);expect(await page.evaluate(()=>selectionRuntime.getSnapshot().runtime.tick)).toBe(tick);
 await page.screenshot({path:'/private/tmp/SHE-128-neighborhood-selection.png'});await page.evaluate(()=>{selectionUI.destroy();selectionRuntime.destroy();});expect(errors).toEqual([]);
});
