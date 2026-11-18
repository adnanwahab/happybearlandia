import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const route='/world/city-xray/columns-demo/index.html';
for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 test(`${name} noGPU accessible evidence and reduced motion`,async({page},info)=>{
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));await page.goto(route);
  await expect(page.locator('#status')).toContainText('NOT RUN');await expect(page.locator('tbody tr')).toHaveCount(544);await page.locator('#sample').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page.locator('#evidence')).toContainText('Missing');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:info.outputPath(`${name}-noGPU.png`),fullPage:true});
 });
 test(`${name} native GPU rendered columns and lifecycle`,async({page},info)=>{
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(route);await page.waitForFunction(()=>window.columnsDiagnostic?.ready||window.columnsDiagnostic?.unavailable);
  const native=await page.evaluate(()=>{const d=window.columnsDiagnostic;return d.ready&&d.renderer.backend.isWebGPUBackend&&d.adapter.isFallbackAdapter===false&&!/swiftshader|llvmpipe|software/i.test(JSON.stringify(d.adapter));});
  test.skip(!native,'NOT RUN: nonfallback native GPU adapter unavailable');
  expect(await page.evaluate(()=>window.columnsDiagnostic.layer.stats().drawCalls)).toBe(2);expect(await page.evaluate(()=>window.columnsDiagnostic.layer.stats().count)).toBeGreaterThan(2000);
  await page.screenshot({path:info.outputPath(`${name}-native.png`),fullPage:true});
  const before=await page.context().newPage();await before.setViewportSize({width,height});await before.goto('/world/city-xray/fixtures/preview.html');await before.waitForFunction(()=>window.diagnostic?.ready);await before.screenshot({path:info.outputPath(`${name}-before-contract.png`),fullPage:true});await before.close();
  await info.attach('source-and-adapter',{body:JSON.stringify({testedCommit,viewport:{width,height},...await page.evaluate(()=>({hash:window.columnsDiagnostic.hash,adapter:window.columnsDiagnostic.adapter,columns:window.columnsDiagnostic.layer.stats()}))}),contentType:'application/json'});
  const pixelEvidence=await page.evaluate(async()=>{
   const d=window.columnsDiagnostic,r=d.renderer,device=r.backend.device;device.pushErrorScope('validation');
   const capture=async()=>{await r.renderAsync(d.scene,d.camera);const c=document.createElement('canvas');c.width=r.domElement.width;c.height=r.domElement.height;const ctx=c.getContext('2d');ctx.drawImage(r.domElement,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
   const on=await capture();d.layer.setEnabled(false);const off=await capture();d.layer.setEnabled(true);d.layer.setView({camera:d.camera});await r.renderAsync(d.scene,d.camera);
   let changed=0,green=0,warm=0;for(let i=0;i<on.length;i+=4){if(Math.abs(on[i]-off[i])+Math.abs(on[i+1]-off[i+1])+Math.abs(on[i+2]-off[i+2])>20)changed++;if(on[i+1]>150&&on[i+1]>on[i+2]*1.3)green++;if(on[i]>150&&on[i]>on[i+2]*1.5)warm++;}
   return {changed,green,warm,error:(await device.popErrorScope())?.message??null};
  });
  expect(pixelEvidence.error).toBeNull();expect(pixelEvidence.changed).toBeGreaterThan(100);expect(pixelEvidence.green).toBeGreaterThan(20);expect(pixelEvidence.warm).toBeGreaterThan(20);
  await info.attach('native-pixel-evidence',{body:JSON.stringify(pixelEvidence),contentType:'application/json'});
  const rendered=await page.evaluate(async()=>{const d=window.columnsDiagnostic,r=d.renderer;const previous=r.info.autoReset;r.info.autoReset=false;const count=async()=>{r.info.reset();await r.renderAsync(d.scene,d.camera);await r.backend.device.queue.onSubmittedWorkDone();return r.info.render.drawCalls;};const on=await count();d.layer.setEnabled(false);const context=await count();d.layer.setEnabled(true);d.layer.setView({camera:d.camera});await r.renderAsync(d.scene,d.camera);r.info.autoReset=previous;return {adapter:d.adapter,columns:d.layer.stats(),actualSceneDrawCalls:on,contextDrawCalls:context,actualColumnDrawCalls:on-context};});
  expect(rendered.actualColumnDrawCalls).toBe(2);expect(rendered.actualSceneDrawCalls).toBeLessThanOrEqual(6);
  await writeFile(info.outputPath(`${name}-native-evidence.json`),JSON.stringify({testedCommit,viewport:{width,height},pixelEvidence,...rendered},null,2));
  const target=await page.evaluate(async()=>{const d=window.columnsDiagnostic,T=await import('three/webgpu'),rect=d.renderer.domElement.getBoundingClientRect();for(let i=0;i<d.layer.stats().count;i++){const row=d.layer.resolve(i);if(row.height<75)continue;const p=new T.Vector3(...row.position);p.y+=row.height*.9;p.project(d.camera);if(Math.abs(p.x)>.7||Math.abs(p.y)>.7)continue;const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(p.x,p.y),d.camera);const hit=d.layer.pick(ray);if(hit)return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,roadId:hit.roadId};}return null;});
  expect(target).not.toBeNull();await page.mouse.click(target.x,target.y);await expect(page.locator('#evidence')).toContainText(target.roadId);

  await page.locator('#quality').selectOption('4');expect(await page.evaluate(()=>window.columnsDiagnostic.layer.stats().count)).toBeLessThan(1100);
  await page.getByRole('button',{name:'Hide columns'}).click();expect(await page.evaluate(()=>window.columnsDiagnostic.layer.stats().allocatedBufferBytes)).toBe(0);await page.getByRole('button',{name:'Show columns'}).click();await page.getByRole('button',{name:'Fixed aerial camera'}).click();
  await page.locator('#sample').selectOption({index:12});await expect(page.locator('#evidence')).toContainText('authored-road-intensity');
  expect(await page.evaluate(()=>window.columnsDiagnostic.errors)).toEqual([]);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const cameraBefore=await page.evaluate(()=>window.columnsDiagnostic.camera.position.toArray());await page.getByRole('button',{name:'Fixed aerial camera'}).click();expect(await page.evaluate(()=>window.columnsDiagnostic.camera.position.toArray())).toEqual(cameraBefore);
  await page.evaluate(()=>window.columnsDiagnostic.renderer.backend.device.destroy());await expect(page.locator('#status')).toContainText('Graphics device lost');
  await page.evaluate(()=>window.columnsDiagnostic.dispose());await expect(page.locator('canvas')).toHaveCount(0);
 });
}
