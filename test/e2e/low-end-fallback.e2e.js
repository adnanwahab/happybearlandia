import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {cpus,platform,release} from 'node:os';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1)};};
for(const width of [320,390])for(const mode of ['explicit-canvas','simulated-no-gpu'])test(`${width}px ${mode}`,async({browser,baseURL},info)=>{
 const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],latency={};
 page.on('pageerror',error=>errors.push(error.message));
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 if(mode==='simulated-no-gpu')await context.addInitScript(()=>{
  Object.defineProperty(navigator,'gpu',{get:()=>undefined,configurable:true});
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl|webgpu/i.test(type)?null:Reflect.apply(original,this,[type,...args]);};
 });
 async function measure(name,action){const start=performance.now();await action();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));(latency[name]??=[]).push(performance.now()-start);}
 try{
  await page.goto(baseURL+'/world/future-machine.html'+(mode==='explicit-canvas'?'?renderer=canvas':''));
  // A controlled HTTP failure must surface, then the normal Fork City action retries.
  await page.route('**/api/city-experiments',route=>route.fulfill({status:503,json:{error:'Benchmark injected transient failure'}}));
  await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/city-experiments');
  await measure('retry',async()=>{await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);});
  await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
  const original=await page.evaluate(()=>JSON.stringify(window.futureMachine.history));
  for(let repeat=0;repeat<3;repeat++)for(const month of [0,16,60,120])await measure('scrub',async()=>{
   const slider=page.getByTestId('future-machine-timeline');await slider.fill(String(month));await slider.dispatchEvent('input');
   expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(month);
  });
  await measure('selection',async()=>{await page.getByRole('button',{name:/building-d1 · schematic/}).first().click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-d1');});
  const canvas=page.getByTestId('future-machine-stage').locator('canvas');await canvas.scrollIntoViewIfNeeded();await canvas.focus();
  const camera=()=>page.evaluate(()=>window.futureMachine.stats.scene.camera);
  for(let i=0;i<10;i++){
   const before=await camera();await measure('pan',()=>canvas.press('ArrowRight'));expect((await camera()).x).not.toBe(before.x);
   const beforeZoom=await camera();await measure('zoom',()=>canvas.press('+'));expect((await camera()).zoom).toBeGreaterThan(beforeZoom.zoom);
  }
  // Canvas is event-driven. RAF cadence under repeated real input is a browser
  // scheduling measurement, not a count of rendered Canvas frames.
  const cadence=await page.evaluate(async()=>{
   const canvas=document.querySelector('[data-testid="future-machine-stage"] canvas'),intervals=[];let last=performance.now();
   const ctx=canvas.getContext('2d'),clear=ctx.clearRect;let draws=0;
   ctx.clearRect=function(...args){draws++;return Reflect.apply(clear,this,args);};
   const start=performance.now();
   try {
   for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);const now=performance.now();intervals.push(now-last);last=now;canvas.dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowLeft':'ArrowRight',bubbles:true}));}
   return {intervals,draws,elapsedMs:performance.now()-start};
   } finally {ctx.clearRect=clear;}
  });
  expect(cadence.draws).toBeGreaterThanOrEqual(120);
  expect(await page.evaluate(()=>JSON.stringify(window.futureMachine.history))).toBe(original);
  expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);
  expect(errors).toEqual([]);
  const history=await page.evaluate(()=>{const h=window.futureMachine.history;return {seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,recipe:h.recipe,provenance:h.provenance};});
  await page.screenshot({path:info.outputPath('mobile-canvas.png'),fullPage:true});
  const report={schemaVersion:'low-end-fallback.v1',recordedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode,environment:{browser:browser.version(),os:`${platform()} ${release()}`,cpu:cpus()[0]?.model,viewport:{width,height:844},deviceScaleFactor:2,cpuThrottleRate:4,launchArgs:['--disable-gpu'],...await page.evaluate(()=>({userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,backend:window.futureMachine.stats.scene.backend}))},history,latency:Object.fromEntries(Object.entries(latency).map(([k,v])=>[k,{...summarize(v),rawMs:v}])),cadence:{...summarize(cadence.intervals),rafHz:1000/(cadence.intervals.reduce((a,b)=>a+b,0)/cadence.intervals.length),rawMs:cadence.intervals},canvasDraws:{count:cadence.draws,elapsedMs:cadence.elapsedMs,drawCallsPerSecond:cadence.draws*1000/cadence.elapsedMs,displayedFps:null},errors,limitations:['Desktop Chromium mobile viewport and 4x CDP CPU throttle; not physical low-end hardware.','GPU APIs are deliberately suppressed in simulated-no-gpu; Canvas2D may use host acceleration.','RAF Hz is scheduling cadence during input; clearRect counts completed draw invocations, not displayed FPS. Canvas draws on demand.','Latency includes Playwright dispatch, assertions and two RAF callbacks; not hardware input-to-photon latency.','Synthetic City recipe; unchanged history asserted across interactions.','No performance budget pass claim: SHE-40 remains in progress.']};
  const reportPath=info.outputPath('benchmark.json');
  await writeFile(reportPath,JSON.stringify(report,null,2));
  await info.attach('benchmark',{path:reportPath,contentType:'application/json'});
 }finally{await context.close();}
});
