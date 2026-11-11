import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test('actual City first divergence retains seed, evidence and selection through graphics loss',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world/future-machine.html?renderer=webgl');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status)).toBe('ready');
 await page.getByTestId('future-machine-timeline').fill('16');
 await page.getByTestId('future-machine-timeline').dispatchEvent('input');
 await page.getByRole('button',{name:/building-project-policy-1-0 · schematic/}).last().click();
 const read=()=>page.evaluate(()=>({
  seed:window.futureMachine.history.seed,experimentId:window.futureMachine.history.experimentId,
  initialHash:window.futureMachine.history.initialHash,month:window.futureMachine.state.month,
  metrics:window.futureMachine.state.diff.metrics,camera:window.futureMachine.stats.scene.camera,
  backend:window.futureMachine.stats.scene.backend,selected:window.futureMachine.stats.scene.selected,
 }));
 const before=await read();expect(before.backend).toBe('webgl');expect(before.metrics.housingUnits.delta).toBe(24);
 await page.locator('.fm-stage').screenshot({path:testInfo.outputPath('recorded-month-16-webgl.png')});
 await page.evaluate(()=>{
  const context=document.querySelector('.fm-stage canvas').getContext('webgl2');
  const extension=context.getExtension('WEBGL_lose_context');
  if(!extension)throw new Error('Actual context-loss extension unavailable');extension.loseContext();
 });
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
 const after=await read();
 expect(after.seed).toBe(42);expect(after.seed).toBe(before.seed);expect(after.experimentId).toBe(before.experimentId);
 expect(after.initialHash).toBe(before.initialHash);expect(after.month).toBe(16);expect(after.metrics).toEqual(before.metrics);
 expect(after.selected).toEqual({collection:'buildings',id:'building-project-policy-1-0'});
 expect(after.camera.x).toBe(before.camera.target[0]);expect(after.camera.z).toBe(before.camera.target[2]);
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('16-0');
 await page.locator('.fm-stage').screenshot({path:testInfo.outputPath('recorded-month-16-canvas.png')});
 const evidencePath=testInfo.outputPath('recorded-context-loss-evidence.json');
 await writeFile(evidencePath,JSON.stringify({schemaVersion:'research-context-loss.v1',before,after},null,2));
 await testInfo.attach('recorded-context-loss-evidence',{path:evidencePath,contentType:'application/json'});
 expect(errors).toEqual([]);
});

test('actual WebGL context loss retains selected entity, month and camera target in Canvas',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world/future-machine.html?renderer=webgl');
 const before=await page.evaluate(async()=>{
  window.futureMachine.dispose();
  const {createStage}=await import('/world/future-machine/scene/index.js');
  const host=document.createElement('div');host.style.width='800px';document.body.append(host);
  const stage=createStage(host);await stage.whenReady();window.researchStage=stage;
  const state={month:16,buildings:[{id:'a',floors:2},{id:'b',floors:3}],projects:[]};
  stage.update({month:16,baseline:{state},plan:{state}},{month:16,available:true,entities:[{collection:'buildings',id:'b',physical:true,kind:'changed'}]});
  stage.focus({collection:'buildings',id:'b'});
  const camera=stage.getCamera(),backend=stage.getStats().backend;
  const canvas=host.querySelector('canvas');
  const context=canvas.getContext('webgl2');
  const extension=context.getExtension('WEBGL_lose_context');
  if(!extension)throw new Error('Actual WebGL loss extension unavailable');
  extension.loseContext();window.researchHost=host;
  return {camera,backend};
 });
 expect(before.backend).toBe('webgl');
 await expect.poll(()=>page.evaluate(()=>window.researchStage.getStats().backend)).toBe('canvas2d');
 const after=await page.evaluate(()=>({stats:window.researchStage.getStats(),camera:window.researchStage.getCamera(),canvases:window.researchHost.querySelectorAll('canvas').length,labels:window.researchHost.querySelectorAll('span').length,text:window.researchHost.textContent}));
 expect(after.stats.month).toBe(16);expect(after.stats.selected).toEqual({collection:'buildings',id:'b'});
 expect(after.camera.x).toBe(before.camera.target[0]);expect(after.camera.z).toBe(before.camera.target[2]);
 expect(after.canvases).toBe(1);expect(after.labels).toBe(0);expect(after.text).toContain('2D projection');
 expect(await page.evaluate(()=>window.researchStage.focus({collection:'buildings',id:'a'}))).toBe(true);
 await page.evaluate(()=>window.researchStage.dispose());expect(errors).toEqual([]);
});

test('live reduced motion finishes camera focus and allows later animation when restored',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/world/future-machine.html?renderer=webgl');
 const initial=await page.evaluate(async()=>{
  window.futureMachine.dispose();
  const {createStage}=await import('/world/future-machine/scene/index.js');
  const host=document.createElement('div');host.style.width='800px';document.body.append(host);
  const stage=createStage(host);await stage.whenReady();window.researchStage=stage;
  const state={month:16,buildings:[{id:'a',floors:2},{id:'b',floors:3}],projects:[]};
  stage.update({month:16,baseline:{state},plan:{state}},{month:16,available:true,entities:[{collection:'buildings',id:'b',physical:true,kind:'changed'}]});
  const entity={collection:'buildings',id:'b'};
  stage.focus(entity);const end=stage.getCamera();stage.resetCamera();
  stage.focus(entity,{animate:true});
  return {backend:stage.getStats().backend,end,start:stage.getCamera()};
 });
 expect(initial.backend).toBe('webgl');expect(initial.start).not.toEqual(initial.end);
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect.poll(()=>page.evaluate(()=>window.researchStage.getCamera())).toEqual(initial.end);
 const stable=await page.evaluate(async()=>{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return {camera:window.researchStage.getCamera(),month:window.researchStage.getStats().month,objects:window.researchStage.getStats().objects};
 });
 expect(stable.camera).toEqual(initial.end);expect(stable.month).toBe(16);expect(stable.objects).toBeGreaterThan(0);
 await page.emulateMedia({reducedMotion:'no-preference'});
 const restarted=await page.evaluate(()=>{
  const stage=window.researchStage;stage.resetCamera();stage.focus({collection:'buildings',id:'b'},{animate:true});
  return stage.getCamera();
 });
 expect(restarted).not.toEqual(initial.end);
 await page.evaluate(()=>window.researchStage.dispose());
 await page.emulateMedia({reducedMotion:'reduce'});expect(errors).toEqual([]);
});

test('Canvas host clears missing matched snapshots and recovers without stale inventory',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/world/future-machine.html?renderer=canvas');
 const result=await page.evaluate(async()=>{
  window.futureMachine.dispose();
  const {createStage}=await import('/world/future-machine/scene/index.js');
  const host=document.createElement('div');host.style.width='800px';document.body.append(host);
  const stage=createStage(host);await stage.whenReady();
  const state={month:16,buildings:[{id:'recorded-building',floors:2}],projects:[]};
  const snapshot={state};const frame={month:16,baseline:snapshot,plan:snapshot};
  const diff={month:16,available:true,entities:[]};
  const missing=[];
  for(const arm of ['baseline','plan']){
   stage.update(frame,diff);
   const before=stage.getStats();
   stage.update({...frame,[arm]:null},null);
   missing.push({before:before.objects,after:stage.getStats().objects,month:stage.getStats().month,text:host.textContent,buttons:host.querySelectorAll('button').length,focused:stage.focus({collection:'buildings',id:'recorded-building'})});
  }
  stage.update(frame,diff);const recovered={...stage.getStats(),text:host.textContent};
  stage.dispose();host.remove();return {missing,recovered};
 });
 for(const missing of result.missing){
  expect(missing.before).toBeGreaterThan(0);expect(missing.after).toBe(0);expect(missing.month).toBeNull();
  expect(missing.text).toContain('Both futures are required');expect(missing.buttons).toBe(0);expect(missing.focused).toBe(false);
 }
 expect(result.recovered.backend).toBe('canvas2d');expect(result.recovered.month).toBe(16);expect(result.recovered.objects).toBeGreaterThan(0);
 expect(result.recovered.text).toContain('Canvas2D low-fidelity view');expect(result.recovered.text).not.toContain('Both futures are required');
 expect(errors).toEqual([]);
});
