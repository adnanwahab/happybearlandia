import {test,expect} from '@playwright/test';
for(const quality of ['LOW','HIGH'])test(`roof detail fixture and missing geometry · ${quality}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(`/world?synthetic=1&people=16&quality=${quality}`);
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{BuildingCutaway}=await import('/world/render/buildings/cutaway.js');
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshStandardMaterial()),detailGeometry=new THREE.Group();
  detailGeometry.add(new THREE.Mesh(new THREE.BoxGeometry(8,.2,8),new THREE.MeshStandardMaterial()));scene.add(mesh,detailGeometry);detailGeometry.visible=false;
  const original=mesh.geometry,cut=new BuildingCutaway(scene);cut.select({id:'authored-fixture',mesh,detailGeometry});cut.setEnabled(true);cut.update(0,.016,matchMedia('(prefers-reduced-motion: reduce)').matches);
  const open=cut.status;cut.setEnabled(false);cut.update(1,.016,true);const restored=mesh.geometry===original;
  cut.select({id:'missing',mesh});const missing=cut.setEnabled(true);cut.dispose();return {open,restored,missing};
 });
 expect(result.open.progress).toBe(1);expect(result.open.id).toBe('authored-fixture');expect(result.restored).toBe(true);expect(result.missing).toBe(false);
 await page.getByRole('button',{name:'Open graphics settings'}).click();const button=page.locator('[data-cutaway]');await button.focus();await page.keyboard.press('Enter');await expect(button).toHaveAttribute('aria-pressed','false');
});
