import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('actual worker pool failure recovers deterministically and inspector controls stay capability gated',async({page})=>{
 let faults=0;
 await page.route('**/__living-worker-fault',route=>route.fulfill({json:{crash:++faults===1}}));
 await page.route('**/__living-worker-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));
 await page.goto('/__living-worker-test');
 await page.evaluate(async()=>{
  const {getWorkerRegistry}=await import('/world/workers/worker-registry.js');
  const {createWorkerPool}=await import('/world/workers/priority-pool.js');
  const {mountWorkerInspector}=await import('/world/workers/inspector.js');
  const code=`postMessage({type:'WORKER_READY'});setInterval(()=>postMessage({type:'WORKER_HEARTBEAT'}),500);onmessage=async({data})=>{postMessage({type:'TASK_START',taskId:data.taskId});if(data.kind==='recover'){const response=await fetch('${location.origin}/__living-worker-fault');if((await response.json()).crash){setTimeout(()=>{throw new Error('Deliberate deterministic fixture crash');},0);return;}}postMessage({type:'TASK_PROGRESS',taskId:data.taskId,progress:.5});setTimeout(()=>postMessage({type:'TASK_DONE',taskId:data.taskId,result:{value:data.payload.value*2,seed:data.payload.seed}}),20);};`;
  window.workerURL=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  window.registry=getWorkerRegistry();window.pool=createWorkerPool({id:'actual-fixture-pool',url:window.workerURL,size:1,maxRetries:1});
  window.inspector=mountWorkerInspector({container:document.querySelector('main'),registry:window.registry});
  window.recovery=window.pool.submit({kind:'recover',payload:{value:21,seed:42},deterministic:true});
 });
 expect(await page.evaluate(()=>window.recovery)).toEqual({value:42,seed:42});
 expect(faults).toBe(2);
 await page.getByTestId('workers-button').click();
 const drawer=page.getByTestId('worker-inspector');
 await expect(drawer).toContainText('1 registered');
 await expect(drawer.locator('[data-errors]')).toContainText('Deliberate deterministic fixture crash');
 await expect(drawer).toContainText('Per-worker memory: unavailable');
 await expect(drawer.getByRole('button',{name:'Pause pool',exact:true})).toHaveCount(0);
 await page.evaluate(async()=>{
  window.inspector.destroy();const {mountWorkerInspector}=await import('/world/workers/inspector.js');
  window.inspector=mountWorkerInspector({container:document.querySelector('main'),registry:window.registry,capabilities:{pausePool:true,resumePool:true,setPoolSize:true},actions:{pausePool:id=>window.registry.performAction(id,'pause',null,{developer:true}),resumePool:id=>window.registry.performAction(id,'resume',null,{developer:true}),setPoolSize:(id,count)=>window.registry.performAction(id,'resize',count,{developer:true})}});
 });
 await page.getByTestId('workers-button').click();
 await drawer.getByRole('button',{name:'Pause pool',exact:true}).click();
 expect(await page.evaluate(()=>window.pool.snapshot().paused)).toBe(true);
 await page.evaluate(()=>{window.queued=window.pool.submit({kind:'normal',payload:{value:5,seed:42},deterministic:true});});
 expect(await page.evaluate(()=>window.pool.snapshot().queueDepth)).toBe(1);
 await drawer.getByRole('button',{name:'Resume pool',exact:true}).click();
 expect(await page.evaluate(()=>window.queued)).toEqual({value:10,seed:42});
 await drawer.locator('[data-pool-size]').fill('2');await drawer.getByRole('button',{name:'Set count',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.pool.snapshot().size)).toBe(2);
 await expect(page.getByTestId('workers-button')).toHaveText('Workers · 2');
 const downloadPromise=page.waitForEvent('download');await drawer.getByRole('button',{name:'Download worker report',exact:true}).click();const download=await downloadPromise;const diagnostics=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(diagnostics.version).toBe('hbl.worker-diagnostics.v1');expect(diagnostics.inventory.workers).toHaveLength(2);expect(diagnostics.inventory.errors.length).toBeGreaterThan(0);expect(diagnostics.memory).toBe('unavailable');
 await page.screenshot({path:'/private/tmp/hbl-living-workers.png'});
 await page.evaluate(()=>{window.inspector.destroy();window.pool.destroy();URL.revokeObjectURL(window.workerURL);});
});

test('show work uses reported range and termination requires an explicit second confirmation',async({page})=>{
 await page.route('**/__living-worker-controls',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));await page.goto('/__living-worker-controls');
 await page.evaluate(async()=>{
  const {createTrackedWorker,getWorkerRegistry}=await import('/world/workers/worker-registry.js');const {mountWorkerInspector}=await import('/world/workers/inspector.js');
  window.workEvents=[];window.terminations=0;addEventListener('world:worker-show-work',event=>window.workEvents.push(event.detail));
  const code=`postMessage({type:'WORKER_READY'});onmessage=({data})=>{postMessage({type:'TASK_START',taskId:'range-sum'});let sum=0;for(let i=data.start;i<=data.end;i++)sum+=i;postMessage({type:'TASK_DONE',taskId:'range-sum',result:sum});};`;
  window.url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));window.worker=createTrackedWorker(window.url,{type:'module'},{id:'range-worker',type:'Analysis fixture',ownership:{agentRange:[0,24]},protocol:true,capabilities:{terminate:true}});
  window.actualResult=new Promise(resolve=>window.worker.addEventListener('message',({data})=>{if(data.type==='TASK_DONE')resolve(data.result);}));window.worker.postMessage({start:0,end:24});
  window.inspector=mountWorkerInspector({container:document.querySelector('main'),registry:getWorkerRegistry(),capabilities:{terminateWorker:true},actions:{terminateWorker:id=>{if(id!==window.worker.registryId)throw new Error('Worker not owned by this control');window.terminations++;window.worker.terminate();}}});
 });
 expect(await page.evaluate(()=>window.actualResult)).toBe(300);
 await page.getByTestId('workers-button').click();const drawer=page.getByTestId('worker-inspector');await drawer.getByRole('button',{name:'range-worker',exact:true}).click();
 await drawer.getByRole('button',{name:'Show work in world',exact:true}).click();expect(await page.evaluate(()=>window.workEvents)).toEqual([{workerId:'range-worker',type:'Analysis fixture',ownership:{agentRange:[0,24]}}]);
 await drawer.getByRole('button',{name:'Terminate worker',exact:true}).click();expect(await page.evaluate(()=>window.terminations)).toBe(0);
 await drawer.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>window.terminations)).toBe(0);
 await drawer.getByRole('button',{name:'Terminate worker',exact:true}).click();await drawer.getByRole('button',{name:'Confirm termination',exact:true}).click();
 expect(await page.evaluate(()=>window.terminations)).toBe(1);await expect(page.getByTestId('workers-button')).toHaveText('Workers · 0');
 await page.evaluate(()=>{window.inspector.destroy();URL.revokeObjectURL(window.url);});
});
