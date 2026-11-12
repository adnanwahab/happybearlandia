import {test,expect} from '@playwright/test';

// CDP counters include detached DOM/listeners, unlike querySelectorAll. Collect
// after explicit GC and a warm-up; JS heap is evidence, not a portable budget.
for(const requested of ['canvas','webgl','auto'])test(`${requested}: 30 replay stage lifecycles`,async({page},info)=>{
 const errors=[],warnings=[],samples=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('HeapProfiler.enable');
 await page.addInitScript(()=>{
  const pending=new Set(),request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>{let id=request(time=>{pending.delete(id);callback(time);});pending.add(id);return id;};
  window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id);};
  let observers=0;
  const NativeObserver=window.ResizeObserver;
  window.ResizeObserver=class extends NativeObserver{
   active=false;
   observe(...args){super.observe(...args);if(!this.active){this.active=true;observers++;}}
   disconnect(){super.disconnect();if(this.active){this.active=false;observers--;}}
  };
  window.disposalResources=()=>({animationFrames:pending.size,observers});
  window.disposalGPU={created:0,lost:[]};
  const prototype=globalThis.GPUCanvasContext?.prototype;
  if(prototype){const configure=prototype.configure,seen=new WeakSet();prototype.configure=function(config){
   const result=Reflect.apply(configure,this,[config]);
   if(!seen.has(config.device)){seen.add(config.device);window.disposalGPU.created++;config.device.lost.then(info=>window.disposalGPU.lost.push({reason:info.reason,message:info.message}));}
   return result;
  };}
 });
 await page.goto('/world/future-machine.html'+(requested==='auto'?'':`?renderer=${requested}`));
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 await page.evaluate(async()=>{
  const history=window.futureMachine.history;
  window.futureMachine.dispose();
  const {createStage}=await import('/world/future-machine/scene/index.js');
  const {getFrame}=await import('/world/future-machine/data/index.js');
  const {compareFrame}=await import('/world/future-machine/diff/index.js');
  const host=document.createElement('div');host.style.width='900px';document.body.append(host);
  window.disposalRun={history,createStage,getFrame,compareFrame,host};
 });
 async function cycle(){return page.evaluate(async()=>{
  const {history,createStage,getFrame,compareFrame,host}=window.disposalRun;
  const stage=createStage(host,{history});
  const update=month=>{const frame=getFrame(history,month);stage.update(frame,compareFrame(frame));};
  update(0);await stage.whenReady();stage.setMode('split');
  const entity={collection:'buildings',id:history.baseline[0].state.buildings[0].id};
  const focused=stage.focus(entity);
  for(const month of [16,120,15,0,120])update(month);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const live=stage.getStats();stage.dispose();stage.dispose();
  const disposed=stage.getStats();
  return {focused,live,disposed,remainingNodes:host.childElementCount};
 });}
 async function counters(){await cdp.send('HeapProfiler.collectGarbage');return {...await cdp.send('Memory.getDOMCounters'),...await page.evaluate(()=>({...window.disposalResources(),heap:performance.memory?.usedJSHeapSize??null,gpu:structuredClone(window.disposalGPU)}))};}
 let baseline;
 try{
  // Prime module, shader and browser caches before the measured 30 cycles.
  await cycle();baseline=await counters();
  for(let i=0;i<30;i++){
   const result=await cycle(),resources=await counters();samples.push({cycle:i+1,...result,resources});
   expect(result.focused).toBe(true);expect(result.live.mode).toBe('split');expect(result.live.month).toBe(120);
   expect(result.live.backend).toBe(requested==='auto'?samples[0].live.backend:requested==='canvas'?'canvas2d':'webgl');
   expect(result.live.objects).toBe(samples[0].live.objects);
   expect(result.live.geometries).toBe(samples[0].live.geometries);expect(result.live.textures).toBe(samples[0].live.textures);
   expect(result.disposed.objects).toBe(0);expect(result.disposed.backend).toBe('disposed');expect(result.remainingNodes).toBe(0);
   expect(resources.jsEventListeners).toBeLessThanOrEqual(baseline.jsEventListeners);
   expect(resources.nodes).toBeLessThanOrEqual(baseline.nodes+10);
   expect(resources.animationFrames).toBe(baseline.animationFrames);expect(resources.observers).toBe(baseline.observers);
  }
  expect(errors).toEqual([]);
  expect(samples.at(-1).resources.gpu.lost.filter(loss=>loss.reason!=='destroyed')).toEqual([]);
 }finally{
  await info.attach('renderer-disposal-evidence',{body:JSON.stringify({requested,browser:page.context().browser().version(),baseline,samples,errors,warnings,
   provenance:await page.evaluate(()=>{const h=window.disposalRun.history;return {seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,recipe:h.recipe,provenance:h.provenance};}),
   limitations:['Synthetic monthly City replay; same versioned history reused without mutation.','CDP DOM/listener counters and JS heap do not measure GPU memory or all JS objects.','Auto backend reports actual initialization; WebGPU coverage requires a WebGPU result.','Controlled device-loss recovery is covered separately by pipeline-device-loss.e2e.js.']},null,2),contentType:'application/json'});
 }
});
