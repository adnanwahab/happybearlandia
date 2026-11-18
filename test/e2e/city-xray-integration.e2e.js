import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
async function openWorld(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/area?**',r=>r.fulfill({json:{source:'none'}}));
 await page.goto('/world');await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);await expect(page.locator('#city-xray-toggle')).toBeEnabled();await page.waitForFunction(()=>{const s=window.hblWorldActivity?.getSnapshot();return s?.peopleCount>0&&!/resetting/.test(s.runId);});return errors;
}
for(const [name,width,height]of[['desktop',1440,1000],['mobile',390,844]])test(`${name} combined native World entry controls and return`,async({page},info)=>{
 await page.setViewportSize({width,height});const errors=await openWorld(page);await page.screenshot({path:info.outputPath(`${name}-world-before.png`)});
 const retained=await page.evaluate(()=>({camera:window.hblCityXray.host.normal.camera.position.toArray(),runId:window.hblWorldActivity.getSnapshot().runId,people:window.hblWorldActivity.getSnapshot().peopleCount}));
 await page.locator('#city-xray-toggle').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.hblCityXray?.presentation);
 await expect(page.getByText('Synthetic demonstration',{exact:true})).toBeVisible();await page.waitForTimeout(500);
 await page.screenshot({path:info.outputPath(`${name}-combined.png`)});
 const state=await page.evaluate(()=>window.hblCityXray.getState());expect(state.particles.count).toBe(18000);expect(state.columns.count).toBeGreaterThan(700);
 await page.locator('[data-xray=play]').click();await page.locator('[data-xray=time]').fill('7');expect(await page.evaluate(()=>window.hblCityXray.getState().seconds)).toBe(7);
 await page.locator('[data-xray=columns]').uncheck();expect(await page.evaluate(()=>window.hblCityXray.getState().columns.allocatedBufferBytes)).toBe(0);await page.locator('[data-xray=columns]').check();
 await page.locator('[data-xray=particles]').uncheck();expect(await page.evaluate(()=>window.hblCityXray.getState().particles.allocatedBufferBytes)).toBe(0);await page.locator('[data-xray=particles]').check();
 await page.locator('[data-xray=quality]').selectOption('low');await expect.poll(()=>page.evaluate(()=>window.hblCityXray.getState().particles.count)).toBe(6000);await page.locator('[data-xray=quality]').selectOption('high');await expect.poll(()=>page.evaluate(()=>window.hblCityXray.getState().particles.count)).toBe(18000);
 const cameraBefore=await page.evaluate(()=>window.hblCityXray.getState().camera);await page.locator('.xray-surface').focus();await page.keyboard.press('ArrowLeft');await page.locator('[data-xray=aerial]').click();await page.locator('[data-xray=previous]').click();expect(await page.evaluate(()=>window.hblCityXray.getState().camera)).not.toEqual(cameraBefore);
 await page.locator('[data-xray=aerial]').click();await page.keyboard.press('Escape');await expect(page.locator('#city-xray')).not.toBeVisible();expect(await page.evaluate(()=>window.hblCityXray.getState().released.particles.allocatedBufferBytes)).toBe(0);await expect(page.locator('#city-xray-toggle')).toBeFocused();
 expect(await page.evaluate(()=>Boolean(window.hblWorldStartup.readyMs))).toBe(true);expect(await page.evaluate(()=>document.querySelector('#top').inert)).toBe(false);expect(await page.evaluate(()=>({camera:window.hblCityXray.host.normal.camera.position.toArray(),runId:window.hblWorldActivity.getSnapshot().runId,people:window.hblWorldActivity.getSnapshot().peopleCount}))).toEqual(retained);expect(errors).toEqual([]);
});
test('reduced motion freezes the cosmetic clock',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openWorld(page);await page.locator('#city-xray-toggle').click();await page.waitForFunction(()=>window.hblCityXray.presentation);await expect(page.locator('[data-xray=play]')).toBeDisabled();expect(await page.evaluate(()=>window.hblCityXray.getState().reducedMotion)).toBe(true);await page.keyboard.press('Escape');
});
test('readable native-unavailable fallback',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));await page.goto('/world');await expect(page).toHaveURL(/static-city\.html/);await expect(page.getByText('WebGL2 city view only · the simulation requires WebGPU.')).toBeVisible();
});
for(const [view,width,height]of[['desktop',1440,1000],['mobile',390,844]])test(`${view} native pixels, deterministic buffers, loss and performance`,async({page},info)=>{
 await page.setViewportSize({width,height});const errors=await openWorld(page);await page.locator('#city-xray-toggle').click();await page.waitForFunction(()=>window.hblCityXray.presentation);
 await page.evaluate(()=>{const p=window.hblCityXray.presentation;p.setPlaying(false);p.seek(0);});
 // WebGPU's current canvas texture expires after presentation. Capture actual
 // compositor pixels, rather than reading an already-cleared canvas texture.
 const capture=async()=>{await page.waitForTimeout(80);return (await page.locator('#view canvas').screenshot({mask:['.xray-deck','.xray-heading','.xray-exit','.xray-caption'].map(s=>page.locator(s)),maskColor:'#000000'})).toString('base64');};
 const on=await capture();await page.evaluate(()=>window.hblCityXray.presentation.setLayer('particles',false));const noParticles=await capture();await page.evaluate(()=>window.hblCityXray.presentation.setLayer('columns',false));const off=await capture();
 await page.evaluate(()=>{const p=window.hblCityXray.presentation;p.setLayer('columns',true);p.setLayer('particles',true);p.seek(7);p.seek(0);});const repeated=await capture();
 const pixelProof=await page.evaluate(async({on,noParticles,off,repeated})=>{
  const decode=async(data)=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
  const [a,b,c,d]=await Promise.all([on,noParticles,off,repeated].map(decode));
  const changed=(x,y)=>{let n=0;for(let i=0;i<x.length;i+=4)if(Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2])>20)n++;return n;};let green=0,warm=0;for(let i=0;i<a.length;i+=4){if(a[i+1]>130&&a[i+1]>a[i+2]*1.4)green++;if(a[i]>130&&a[i]>a[i+2]*1.5)warm++;}return {particles:changed(a,b),columns:changed(b,c),repeat:changed(a,d),green,warm};
 },{on,noParticles,off,repeated});
 const measured=await page.evaluate(async()=>{
  const x=window.hblCityXray,p=x.presentation,r=x.host.renderer,d=r.backend.device;const adapter=await navigator.gpu.requestAdapter();const adapterInfo=Object.fromEntries(['vendor','architecture','description','isFallbackAdapter'].map(k=>[k,adapter.info[k]]));
  d.pushErrorScope('validation');const originalAuto=r.info.autoReset;r.info.autoReset=false;
  const draw=async()=>{r.info.reset();r.render(x.host.normal.scene,x.host.normal.camera);const calls=r.info.render.drawCalls;await d.queue.onSubmittedWorkDone();return calls;};
  const combined=await draw();p.setLayer('particles',false);const withoutParticles=await draw();p.setLayer('columns',false);const context=await draw();p.setLayer('columns',true);p.setLayer('particles',true);p.seek(0);
  const mesh=p.scene.children.find(o=>o.name==='Synthetic demonstration particles'),matrixVersion=mesh.instanceMatrix.version,times=[];
  for(let i=0;i<150;i++){const start=performance.now();await draw();if(i>=30)times.push(performance.now()-start);}
  const matrixUnchanged=mesh.instanceMatrix.version===matrixVersion;r.info.autoReset=originalAuto;times.sort((a,b)=>a-b);const validationError=(await d.popErrorScope())?.message??null;
  return {adapter:adapterInfo,native:r.backend.isWebGPUBackend,draws:{combined,withoutParticles,context},queueCompleted:{warmup:30,samples:120,p50:times[60],p95:times[114],boundary:'CPU render submission plus GPU queue completion; not GPU timestamp or full simulation frame'},matrixUnchanged,stats:p.stats(),validationError};
 });
 const observed=await page.evaluate(async()=>{const times=[];let previous;for(let i=0;i<150;i++){const now=await new Promise(requestAnimationFrame);if(i>=30)times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return {samples:120,p50:times[60],p95:times[114],boundary:'Animation frame wall intervals while normal World simulation and X-Ray presentation run'};});
 await writeFile(info.outputPath('integrated-native-performance.json'),JSON.stringify({testedCommit,viewport:{width,height},...measured,pixelProof,observed},null,2));
 expect(measured.native).toBe(true);expect(measured.adapter.isFallbackAdapter).toBe(false);expect(measured.validationError).toBeNull();expect(pixelProof.particles).toBeGreaterThan(500);expect(pixelProof.columns).toBeGreaterThan(100);expect(pixelProof.green).toBeGreaterThan(50);expect(pixelProof.warm).toBeGreaterThan(50);expect(pixelProof.repeat).toBeLessThan(30);expect(measured.draws.combined-measured.draws.withoutParticles).toBe(1);expect(measured.draws.withoutParticles-measured.draws.context).toBe(2);expect(measured.draws.combined).toBeLessThanOrEqual(12);expect(measured.matrixUnchanged).toBe(true);
 await page.locator('#city-xray summary').click();await expect(page.locator('#city-xray tbody tr')).toHaveCount(544);await expect(page.locator('#city-xray tbody')).toContainText('Missing');await page.locator('#city-xray summary').click();
 await page.locator('[data-xray=exit]').click();await page.locator('#city-xray-toggle').click();await page.waitForFunction(()=>window.hblCityXray.presentation);expect(await page.evaluate(()=>window.hblCityXray.getState().particles.allocatedBufferBytes)).toBe(measured.stats.particles.allocatedBufferBytes);
 await page.evaluate(()=>window.hblCityXray.host.renderer.backend.device.destroy());await expect(page.locator('.xray-status')).toContainText('device lost');expect(await page.evaluate(()=>window.hblCityXray.getState().released.particles.allocatedBufferBytes)).toBe(0);await page.locator('[data-xray=exit]').click();expect(errors).toEqual([]);
});
