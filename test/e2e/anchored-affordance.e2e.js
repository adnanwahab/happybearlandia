import {test,expect} from '@playwright/test';
test.use({hasTouch:true,isMobile:true,viewport:{width:320,height:568},reducedMotion:'reduce'});
test('sampled overlay tracks, clamps, preserves focus and validates activation',async({page})=>{
 await page.goto('/world/decision.html');
 await page.evaluate(async()=>{
  const THREE=await import('/vendor/three/three.module.js');
  const {mountAnchoredAffordance}=await import('/world/render/anchored-affordance.js');
  document.body.replaceChildren();const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const camera=new THREE.PerspectiveCamera(45,320/568,.1,1000);camera.position.set(0,2,20);camera.lookAt(0,2,0);camera.updateMatrixWorld();
  const wall=new THREE.Mesh(new THREE.BoxGeometry(20,20,1),new THREE.MeshBasicMaterial());wall.position.set(0,2,10);wall.updateMatrixWorld();
  window.anchorTest={count:0,target:{key:'sample:p7',id:'p7',label:'resident p7',position:{x:0,y:2,z:0}},occluders:[],wall};
  window.anchorTest.target.inspect=()=>window.anchorTest.count++;
  window.anchorTest.overlay=mountAnchoredAffordance({container:document.body,canvas,THREE,camera,resolve:()=>window.anchorTest.target,getOccluders:()=>window.anchorTest.occluders});window.anchorTest.overlay.update();
 });
 const button=page.locator('[data-anchored-affordance]');await expect(button).toBeVisible();await button.focus();
 const before=await button.boundingBox();await page.evaluate(()=>{anchorTest.target.position.x=3;anchorTest.overlay.update();});
 await expect(button).toBeFocused();const after=await button.boundingBox();expect(after.x).toBeGreaterThan(before.x);expect(after.x+after.width).toBeLessThanOrEqual(312);
 await page.keyboard.press('Enter');await button.tap();expect(await page.evaluate(()=>anchorTest.count)).toBe(2);
 expect(await button.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await page.evaluate(()=>{anchorTest.occluders=[anchorTest.wall];anchorTest.overlay.update();});await expect(button).toBeHidden();await expect(page.locator('canvas')).toBeFocused();
 await page.evaluate(()=>{anchorTest.occluders=[];anchorTest.overlay.update();});await expect(button).toBeVisible();
 await page.evaluate(()=>{anchorTest.target.available=false;});await button.click();expect(await page.evaluate(()=>anchorTest.count)).toBe(2);await expect(button).toBeHidden();
 await page.evaluate(()=>{anchorTest.target=null;anchorTest.overlay.update();anchorTest.overlay.destroy();});await expect(button).toHaveCount(0);
});
test('normal World selection connects a source ID to the anchored inspector action',async({page})=>{
 await page.goto('/world/?demo=1&synthetic=1&people=16&living=0&renderer=webgl');
 const targets=page.locator('#world-spatial-targets');await targets.locator('summary').click();
 const target=targets.locator('button[data-kind="building"]').first();await expect(target).toBeVisible();const id=await target.getAttribute('data-entity-id');await target.focus();await page.keyboard.press('Enter');
 await targets.locator('summary').click();
 const label=page.locator('[data-anchored-affordance]');await expect(label).toBeVisible();await expect(label).toHaveAttribute('data-target-id',id);
 await label.focus();await page.keyboard.press('Enter');await expect(page.locator('#inspect')).toBeVisible();
 const box=await label.boundingBox();expect(box.x).toBeGreaterThanOrEqual(8);expect(box.x+box.width).toBeLessThanOrEqual(312);expect(box.y+box.height).toBeLessThanOrEqual(560);
});
