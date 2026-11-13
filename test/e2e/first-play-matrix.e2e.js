import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {cpus,platform,arch} from 'node:os';

for(const path of ['automatic','no-webgpu','no-graphics'])test(`first play: ${path}`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const evidence={schemaVersion:'first-play-matrix.v1',date:new Date().toISOString(),
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  host:{platform:platform(),arch:arch(),cpu:cpus()[0]?.model},project:info.project.name,
  browser:info.project.use.browserName,browserVersion:page.context().browser().version(),path,
  limitation:'Draw submission timing, not display scanout. Mobile profiles are emulation, not physical devices.'};
 try{
  await page.addInitScript(path=>{
   if(path!=='automatic')Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
   if(path==='no-graphics')HTMLCanvasElement.prototype.getContext=()=>null;
   window.firstPlayProbe={click:null,firstDraw:null,gpu:null};
   const record=canvas=>{if(window.firstPlayProbe.click!==null&&canvas?.closest?.('[data-testid="future-machine-stage"]'))window.firstPlayProbe.firstDraw??=performance.now();};
   for(const Type of [globalThis.WebGLRenderingContext,globalThis.WebGL2RenderingContext,globalThis.CanvasRenderingContext2D]){
    if(!Type)continue;
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','fillRect','fill']){
     const original=Type.prototype[name];if(!original)continue;
     Type.prototype[name]=function(...args){const result=Reflect.apply(original,this,args);record(this.canvas);return result;};
    }
   }
   const queues=new Map();
   if(globalThis.GPUCanvasContext){const original=GPUCanvasContext.prototype.configure;
    GPUCanvasContext.prototype.configure=function(config){const result=Reflect.apply(original,this,[config]);queues.set(config.device.queue,this.canvas);const a=config.device.adapterInfo;window.firstPlayProbe.gpu=a?{vendor:a.vendor,architecture:a.architecture,device:a.device,description:a.description}:null;return result;};}
   if(globalThis.GPUQueue){const original=GPUQueue.prototype.submit;GPUQueue.prototype.submit=function(...args){const result=Reflect.apply(original,this,args);record(queues.get(this));return result;};}
   document.addEventListener('click',event=>{if(event.target.closest('a')?.textContent.trim()==='Play Demo')window.firstPlayProbe.click=performance.now();},true);
   // The homepage click navigates to a new document; retain its time origin.
   document.addEventListener('click',event=>{if(event.target.closest('a')?.textContent.trim()==='Play Demo')sessionStorage.setItem('firstPlayClick',String(performance.timeOrigin+performance.now()));},true);
   const click=sessionStorage.getItem('firstPlayClick');if(click)window.firstPlayProbe.click=Number(click)-performance.timeOrigin;
  },path);
  await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('ready');
  await page.getByRole('button',{name:'Pause demo',exact:true}).click();
  const backend=await page.evaluate(()=>window.futureMachine.stats.scene.backend);
  if(path==='no-graphics')expect(backend).toBe('inventory-fallback');
  else{
   if(path==='no-webgpu')expect(['webgl','canvas2d']).toContain(backend);
   await expect.poll(()=>page.evaluate(()=>window.firstPlayProbe.firstDraw)).not.toBeNull();
  }
  await expect(page.getByLabel('Simulation provenance')).toContainText('SEED 42');
  evidence.receipt=await page.evaluate(()=>{const h=window.futureMachine.history;return {seed:h.seed,modelVersion:h.modelVersion,runId:h.experimentId,initialHash:h.initialHash,recipe:h.recipe,provenance:h.provenance,lengths:[h.baseline.length,h.plan.length]};});
  expect(evidence.receipt.seed).toBe(42);expect(evidence.receipt.lengths).toEqual([121,121]);
  expect(evidence.receipt.recipe.seed).toBe(42);expect(evidence.receipt.modelVersion).toBeTruthy();
  expect(evidence.receipt.runId).toBeTruthy();expect(evidence.receipt.initialHash).toBeTruthy();
  const slider=page.getByTestId('future-machine-timeline');await slider.fill('16');await slider.dispatchEvent('input');
  expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);
  await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();
  await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');
  evidence.backend=backend;evidence.timing=await page.evaluate(()=>{const p=window.firstPlayProbe;return {...p,clickToFirstDrawMs:p.firstDraw===null?null:p.firstDraw-p.click};});
  if(path!=='no-graphics'){expect(evidence.timing.click).not.toBeNull();expect(evidence.timing.clickToFirstDrawMs).toBeGreaterThanOrEqual(0);}
  expect(errors).toEqual([]);
  evidence.outcome='passed';await page.screenshot({path:info.outputPath('first-play.png'),fullPage:true});
 }finally{
  evidence.errors=errors;evidence.outcome??='failed';
  await info.attach('first-play-evidence',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
 }
});
