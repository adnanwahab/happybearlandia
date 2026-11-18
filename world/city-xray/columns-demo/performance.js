/** Run against an already-started isolated harness. Writes evidence outside source. */
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const dir=process.env.XRAY_ARTIFACTS||'/private/tmp/SHE-1046-performance';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:process.env.XRAY_HEADED!=='1',args:['--enable-unsafe-webgpu']});
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:41046/world/city-xray/columns-demo/index.html');await page.waitForFunction(()=>window.columnsDiagnostic?.ready||window.columnsDiagnostic?.unavailable);
  const result=await page.evaluate(async()=>{
   const d=window.columnsDiagnostic;
   if(!d.ready||d.adapter.isFallbackAdapter!==false||/swiftshader|software|llvmpipe/i.test(JSON.stringify(d.adapter)))return {status:'NOT RUN',reason:'No verified nonfallback native adapter',adapter:d.adapter};
   const r=d.renderer,device=r.backend.device;r.info.autoReset=false;device.pushErrorScope('validation');
   const cpu=[],gpu=[];
   for(let i=0;i<150;i++){
    r.info.reset();const start=performance.now();await r.renderAsync(d.scene,d.camera);await device.queue.onSubmittedWorkDone();const elapsed=performance.now()-start;
    const duration=r.backend.trackTimestamp?await r.resolveTimestampsAsync('render'):null;
    if(i>=30){cpu.push(elapsed);if(Number.isFinite(duration)&&duration>0)gpu.push(duration);}
   }
   const error=await device.popErrorScope();const quantile=(a,q)=>{const b=[...a].sort((a,b)=>a-b);return b.length?b[Math.ceil(b.length*q)-1]:null;};
   return {status:error||d.errors.length?'FAIL':'MEASURED',adapter:d.adapter,backend:'Three WebGPURenderer native',warmup:30,samples:120,method:'Serial renderAsync + queue.onSubmittedWorkDone; GPU render-pass timestamps resolved per frame when supported. CPU includes queue synchronization/readback overhead.',resolution:{width:r.domElement.width,height:r.domElement.height,dpr:devicePixelRatio},gpuTimestampMs:gpu.length?{p50:quantile(gpu,.5),p95:quantile(gpu,.95),samples:gpu.length}:'NOT RUN: timestamp-query unavailable',cpuQueueWallMs:{p50:quantile(cpu,.5),p95:quantile(cpu,.95)},columns:d.layer.stats(),rendererRenderCalls:r.info.render.calls,actualDrawCalls:r.info.render.drawCalls,rendererMemory:r.info.memory,jsHeapBytes:performance.memory?.usedJSHeapSize??'NOT RUN',memoryLimit:'Allocated attribute/index bytes are CPU typed arrays mirrored to GPU; exclude alignment, driver, framebuffer, shader, staging and context buffers. Not peak GPU memory or physical phone measurement.',gpuValidationError:error?.message??null,uncapturedErrors:[...d.errors],hash:d.hash};
  });
  result.testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();result.viewport={width,height};
  await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});await writeFile(`${dir}/${name}.json`,JSON.stringify(result,null,2));console.log(name,JSON.stringify(result));await page.close();
 }
}finally{await browser.close();}
