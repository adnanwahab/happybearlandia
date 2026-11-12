import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const scene=page=>page.evaluate(()=>window.futureMachine.stats.scene);
async function seek(page,month){const slider=page.getByTestId('future-machine-timeline');await slider.fill(String(month));await slider.dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}
async function observation(page){return page.evaluate(()=>{const {state,history,stats}=window.futureMachine;return {month:state.month,seed:history.seed,modelVersion:history.modelVersion,runId:history.experimentId,initialHash:history.initialHash,recipe:history.recipe,lengths:[history.baseline.length,history.plan.length],metrics:state.diff.metrics,baseline:history.baseline[state.month],plan:history.plan[state.month],scene:stats.scene,nativeLabels:document.querySelectorAll('[data-native-city-labels] span').length,canvases:document.querySelectorAll('[data-testid="future-machine-stage"] canvas').length};});}

for(const backend of ['webgpu','webgl'])test(`${backend}: actual initialized loss retains recorded month, run and fallback`,async({page},info)=>{
 const errors={page:[],console:[]},warnings=[];
 page.on('pageerror',e=>errors.page.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.console.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:info.config.metadata.sourceRoot,encoding:'utf8'}).trim();
 // Observe real configure calls; return exactly the native result. This captures
 // the device attached to the actual displayed canvas without exposing internals
 // in production or fabricating a lost promise, browser event or backend badge.
 await page.addInitScript(()=>{
  window.actualLossProbe={configured:[]};
  const prototype=globalThis.GPUCanvasContext?.prototype;
  if(prototype){const configure=prototype.configure;prototype.configure=function(configuration){const result=Reflect.apply(configure,this,[configuration]);window.actualLossProbe.configured.push({canvas:this.canvas,device:configuration.device});return result;};}
 });
 await page.goto('/world/future-machine.html'+(backend==='webgl'?'?renderer=webgl':''));
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 const measured=(await scene(page)).backend;
 if(backend==='webgpu'&&measured!=='webgpu'){
  await writeFile(info.outputPath('native-unavailable.json'),JSON.stringify({sourceCommit,requested:backend,measured,scene:await scene(page),errors},null,2));
  test.skip(true,'Native WebGPU did not initialize on this browser; no native loss claim.');
 }
 expect(measured).toBe(backend);await seek(page,16);
 const before=await observation(page);expect(before.seed).toBe(42);expect(before.metrics.housingUnits.delta).toBe(24);expect(before.lengths).toEqual([121,121]);expect(before.canvases).toBe(1);
 const stage=page.getByTestId('future-machine-stage'),nativeLabels=stage.locator('[data-native-city-labels] span');await expect.poll(()=>nativeLabels.count()).toBeGreaterThan(0);await stage.scrollIntoViewIfNeeded();await stage.screenshot({path:info.outputPath('before-loss.png')});
 let loss;
 try{
  loss=await page.evaluate(async backend=>{
   const canvas=document.querySelector('[data-testid="future-machine-stage"] canvas');window.actualLossProbe.oldCanvas=canvas;
   if(backend==='webgpu'){
    const record=window.actualLossProbe.configured.findLast(record=>record.canvas===canvas);
    if(!record?.device||typeof record.device.destroy!=='function')throw Error('Cannot access a controllable real GPUDevice for the displayed canvas');
    const device=record.device,info=device.adapterInfo;
    const adapter=info?Object.fromEntries(['vendor','architecture','device','description'].map(key=>[key,info[key]])):null;
    device.destroy();const lost=await device.lost;
    return {mechanism:'actual GPUDevice.destroy()',reason:lost.reason,message:lost.message,adapter};
   }
   const context=canvas.getContext('webgl2');if(!context)throw Error('Displayed canvas has no actual WebGL2 context');
   const extension=context.getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_lose_context unavailable; no real context loss can be induced');
   const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',event=>resolve({type:event.type,isTrusted:event.isTrusted,defaultPrevented:event.defaultPrevented}),{once:true}));
   extension.loseContext();const event=await lost;
   return {mechanism:'actual WEBGL_lose_context.loseContext()',event,contextLost:context.isContextLost()};
  },backend);
  if(backend==='webgpu')expect(loss.reason).toBe('destroyed');else{expect(loss.contextLost).toBe(true);expect(loss.event.isTrusted).toBe(true);}
  await expect.poll(async()=>(await scene(page)).backend).toBe('canvas2d');
  await expect(nativeLabels).toHaveCount(0);
  const after=await observation(page);
  expect(after.canvases).toBe(1);expect(await page.evaluate(()=>window.actualLossProbe.oldCanvas.isConnected)).toBe(false);
  for(const key of ['month','seed','modelVersion','runId','initialHash','recipe','lengths','metrics','baseline','plan'])expect(after[key]).toEqual(before[key]);
  expect(after.scene.error).toMatch(backend==='webgpu'?/WebGPU device lost/:/Graphics context lost/);
  await stage.screenshot({path:info.outputPath('after-real-loss-canvas.png')});
  await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');
  await seek(page,15);await expect(nativeLabels).toHaveCount(0);expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(0);
  await seek(page,16);expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);
  expect((await scene(page)).backend).toBe('canvas2d');await expect(nativeLabels).toHaveCount(0);
  expect(errors).toEqual({page:[],console:[]});
 }finally{
  await writeFile(info.outputPath('actual-device-loss-evidence.json'),JSON.stringify({schemaVersion:'actual-device-loss.v1',sourceCommit,backend,browser:page.context().browser().version(),before,loss,after:await observation(page),oldCanvasConnected:await page.evaluate(()=>window.actualLossProbe.oldCanvas?.isConnected??null),errors,warnings,limitations:['Explicit device destruction/context-loss extension tests a controlled real loss, not spontaneous driver failure.','Canvas fallback uses the same monthly City records; projection differs from the GPU camera.']},null,2));
 }
});
