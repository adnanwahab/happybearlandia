import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const route='/world/city-xray/particles-demo/index.html';
test('keyboard noGPU disclosure',async({page})=>{await page.goto(route+'?noGPU');await expect(page.locator('#status')).toContainText('NOT RUN');await expect(page.locator('#pause')).toBeDisabled();await expect(page.locator('h1')).toHaveText('Synthetic demonstration');});
for(const [width,height] of [[1440,1000],[390,844]])test(`native GPU ${width}x${height}`,async({page},info)=>{
 await page.setViewportSize({width,height});await page.goto(route);await page.waitForFunction(()=>window.particlesDiagnostic?.ready||window.particlesDiagnostic?.unavailable);expect(await page.evaluate(()=>window.particlesDiagnostic.ready),'native WebGPU required; unavailable is not acceptance').toBe(true);
 const result=await page.evaluate(async()=>{const d=window.particlesDiagnostic;const samples=[];for(let i=0;i<150;i++){const t=performance.now();d.layer.setTime(i/60);await d.renderer.renderAsync(d.scene,d.camera);await d.renderer.backend.device.queue.onSubmittedWorkDone();if(i>=30)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);return {adapter:d.adapter,stats:d.layer.stats(),errors:d.errors,p50:samples[60],p95:samples[114],timing:'CPU render plus GPU queue completion; not GPU timestamp',native:d.renderer.backend.isWebGPUBackend};});
 const proof=await page.evaluate(async()=>{
  const d=window.particlesDiagnostic,r=d.renderer,device=r.backend.device;
  device.pushErrorScope('validation');
  const previous=r.info.autoReset;r.info.autoReset=false;
  const capture=async()=>{r.info.reset();await r.renderAsync(d.scene,d.camera);await device.queue.onSubmittedWorkDone();const draws=r.info.render.drawCalls;const c=document.createElement('canvas');c.width=r.domElement.width;c.height=r.domElement.height;const ctx=c.getContext('2d');ctx.drawImage(r.domElement,0,0);return {pixels:ctx.getImageData(0,0,c.width,c.height).data,draws};};
  const on=await capture();d.layer.setEnabled(false);const off=await capture();d.layer.setEnabled(true);await r.renderAsync(d.scene,d.camera);r.info.autoReset=previous;
  let changed=0,green=0,warm=0;for(let i=0;i<on.pixels.length;i+=4){const a=on.pixels,b=off.pixels;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>20)changed++;if(a[i+1]>130&&a[i+1]>a[i+2]*1.5)green++;if(a[i]>130&&a[i]>a[i+2]*1.5)warm++;}
  return {changed,green,warm,actualParticleDraws:on.draws-off.draws,totalDraws:on.draws,validationError:(await device.popErrorScope())?.message??null};
 });
 expect(proof.validationError).toBeNull();expect(proof.changed).toBeGreaterThan(500);expect(proof.green).toBeGreaterThan(50);expect(proof.warm).toBeGreaterThan(50);expect(proof.actualParticleDraws).toBe(1);
 await writeFile(info.outputPath(`native-${width}.json`),JSON.stringify({testedCommit,viewport:{width,height},...result,proof},null,2));
 expect(result.native).toBe(true);expect(result.adapter.isFallbackAdapter).toBe(false);expect(result.stats.count).toBe(18000);expect(result.errors).toEqual([]);
 await info.attach('source-bound-metrics',{body:JSON.stringify(result),contentType:'application/json'});
 const lit=await page.locator('canvas').screenshot();await info.attach('lit-canvas',{body:lit,contentType:'image/png'});await page.screenshot({path:info.outputPath(`particles-${width}.png`),fullPage:true});await page.locator('#toggle').focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.particlesDiagnostic.layer.stats().count)).toBe(0);const dark=await page.locator('canvas').screenshot();expect(lit.equals(dark),'rendered on/off pixels differ').toBe(false);await info.attach('dark-canvas',{body:dark,contentType:'image/png'});await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.particlesDiagnostic.layer.stats().count)).toBe(18000);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.particlesDiagnostic.renderer.backend.device.destroy());await expect(page.locator('#status')).toContainText('Device lost');expect(await page.evaluate(()=>window.particlesDiagnostic.layer.stats().allocatedBufferBytes)).toBe(0);
});
test('reduced motion freezes cosmetic phase',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await page.goto(route);await page.waitForFunction(()=>window.particlesDiagnostic?.ready||window.particlesDiagnostic?.unavailable);expect(await page.evaluate(()=>window.particlesDiagnostic.ready)).toBe(true);await expect(page.locator('#pause')).toBeDisabled();expect(await page.evaluate(()=>{const l=window.particlesDiagnostic.layer;l.setTime(9);return l.stats().phase;})).toBe(0);});
