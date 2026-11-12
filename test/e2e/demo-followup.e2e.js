import {test,expect,chromium,firefox,webkit} from '@playwright/test';
import {writeFile,access} from 'node:fs/promises';
const route='/world/future-machine.html';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
const scene=page=>page.evaluate(()=>window.futureMachine.stats.scene);
async function seek(page,month){const slider=page.getByRole('slider').first();await slider.fill(String(month));await slider.dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}
function watchErrors(page){const errors={page:[],console:[]};page.on('pageerror',e=>errors.page.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.console.push(m.text());});return errors;}
async function save(info,name,value){await writeFile(info.outputPath(`${name}.json`),JSON.stringify(value,null,2));}
async function record(page,info,name,extra={}){
 const data=await page.evaluate(async()=>{const api=window.futureMachine,h=api.history,s=api.state;
  const {firstDivergence:find,compareHistory}=await import('/world/future-machine/diff/index.js');
  const stop=find(h,compareHistory(h));const firstDivergence=stop?{month:stop.month,...stop.entity,building:h.plan[stop.month].state.buildings.find(row=>row.id===stop.entity.id)}:null;
  return {schemaVersion:'demo-followup-browser-evidence.v1',route:location.pathname+location.search,selectedMonth:s.month,recipe:h.recipe,seed:h.seed,modelVersion:h.modelVersion,initialHash:h.initialHash,runId:h.experimentId,firstDivergence,metrics:s.diff.metrics,evidence:h.plan.slice(0,s.month+1).flatMap(snapshot=>snapshot.events.map(event=>({arm:'plan',snapshotMonth:snapshot.month,...event}))),baseline:h.baseline[s.month],plan:h.plan[s.month],provenance:h.provenance,scene:api.stats.scene,camera:api.stats.scene.camera};});
 await save(info,name,{...data,...extra});await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true});return data;
}
async function fork(page,query=''){await page.goto(route+query);await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await expect.poll(async()=>(await scene(page)).backend).not.toBe('inventory-fallback');}
async function engines(info){const inventory={};for(const [name,type] of Object.entries({chromium,firefox,webkit})){const executable=type.executablePath();let installed=false;try{await access(executable);installed=true;}catch{}inventory[name]={executable,installed,executed:name===info.project.use.browserName};}inventory.safari={executed:false,reason:'Playwright WebKit is not Safari; no Safari support claim.'};await save(info,'local-browser-engines',inventory);}

test('homepage Play Demo: exact matched start and first physical Month 16',async({page},info)=>{
 const errors=watchErrors(page);await engines(info);await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();await ready(page);await page.getByRole('button',{name:'Pause demo',exact:true}).click();
 await seek(page,0);const start=await record(page,info,'homepage-month-0');expect(start.seed).toBe(42);expect(start.recipe.intervention).toMatchObject({type:'housing',amount:24,cost:1000000,delay:0});expect(start.modelVersion).toBeTruthy();expect(start.runId).toBeTruthy();expect(start.initialHash).toBeTruthy();expect(start.baseline.state).toEqual(start.plan.state);expect(start.metrics.housingUnits.delta).toBe(0);expect(start.firstDivergence.month).toBe(16);
 await seek(page,15);expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(0);
 await seek(page,16);await page.getByTestId('future-machine-stage').scrollIntoViewIfNeeded();const first=await record(page,info,'first-physical-month-16');expect(first.metrics.housingUnits.delta).toBe(24);expect(first.metrics.capitalSpending.delta).toBe(1000000);expect(first.evidence.some(e=>e.eventType==='PROJECT_COMPLETE')).toBe(true);expect(first.plan.state.buildings.find(row=>row.id===first.firstDivergence.id)).toEqual(first.firstDivergence.building);
 await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');await record(page,info,'month-16-why');await save(info,'homepage-errors',errors);expect(errors).toEqual({page:[],console:[]});
});

test('native factory and runtime backend diagnostics are truthful',async({page,request},info)=>{
 const errors=watchErrors(page);await fork(page);await seek(page,16);
 const capability=await page.evaluate(async()=>{try{return {gpuAPI:!!navigator.gpu,adapterAvailable:!!await navigator.gpu?.requestAdapter()};}catch(e){return {gpuAPI:!!navigator.gpu,adapterAvailable:false,error:e.message};}});
 const factory=await request.get('/world/future-machine/scene/renderer-backend.js');const result=await record(page,info,'native-backend-month-16',{capability,factory:{status:factory.status(),contentType:factory.headers()['content-type']},errors});expect(['webgpu','webgl','canvas2d']).toContain(result.scene.backend);if(result.scene.backend==='webgpu')expect(capability.adapterAvailable).toBe(true);
 expect(factory.status(),'Pre-R01 base has no native factory; integrate R01 before final acceptance').toBe(200);expect(factory.headers()['content-type']).toMatch(/javascript/);expect(errors).toEqual({page:[],console:[]});
});

for(const renderer of ['default','canvas2d'])test(`${renderer}: repeated scrub, focus, camera resize and disposal`,async({page},info)=>{
 const errors=watchErrors(page);await fork(page,renderer==='canvas2d'?'?renderer=canvas2d':'');await seek(page,120);if(renderer==='canvas2d')expect((await scene(page)).backend).toBe('canvas2d');const samples=[];
 for(let cycle=0;cycle<4;cycle++){
  for(const month of [0,16,120,16,0,120])await seek(page,month);
  await page.getByRole('button',{name:'Show Me What Changed',exact:true}).click();await seek(page,120);await page.getByRole('button',{name:'Difference-only',exact:true}).click();await page.getByRole('button',{name:/side by side|split view/i}).click();
  samples.push(await page.evaluate(()=>({scene:window.futureMachine.stats.scene,heapBytes:performance.memory?.usedJSHeapSize??null,canvases:document.querySelectorAll('[data-testid="future-machine-stage"] canvas').length})));
 }
 const camera=(await scene(page)).camera;await page.setViewportSize({width:390,height:844});await page.getByTestId('future-machine-stage').scrollIntoViewIfNeeded();await page.waitForTimeout(150);expect((await scene(page)).camera).toEqual(camera);expect((await scene(page)).month).toBe(120);const canvas=page.getByTestId('future-machine-stage').locator('canvas').first();await expect(canvas).toBeVisible();
 if(renderer==='canvas2d'){await canvas.focus();await page.keyboard.press('ArrowRight');expect((await scene(page)).camera).not.toEqual(camera);const moved=(await scene(page)).camera;await page.keyboard.press('+');expect((await scene(page)).camera.zoom).toBeGreaterThan(moved.zoom);}
 await record(page,info,`${renderer}-resized-390`,{samples,errors});expect(samples.every(s=>s.canvases===1)).toBe(true);expect(new Set(samples.map(s=>s.scene.objects)).size).toBe(1);expect(new Set(samples.map(s=>s.scene.geometries)).size).toBe(1);
 const after=await page.evaluate(()=>{window.futureMachine.dispose();window.futureMachine.dispose();return {scene:window.futureMachine.stats.scene,canvases:document.querySelectorAll('[data-testid="future-machine-stage"] canvas').length};});await page.waitForTimeout(150);await save(info,`${renderer}-resource-measurements`,{samples,after,errors,limitations:'Heap is diagnostic only: GC timing is uncontrolled. No FPS or zero GPU-memory claim.'});expect(after.canvases).toBe(0);expect(after.scene.objects).toBe(0);expect(errors).toEqual({page:[],console:[]});
});

test('390px expanded World header and shortcuts do not overlap',async({page},info)=>{
 const errors=watchErrors(page);await page.setViewportSize({width:390,height:844});await page.goto('/world/?demo=1&synthetic=1&people=30&renderer=canvas2d');await expect.poll(()=>page.evaluate(()=>window.hblVisualPass?.ready),{timeout:60000}).toBe(true);
 const top=page.locator('#top');if(await top.getAttribute('open')===null)await top.locator(':scope > summary').click();
 const boxes=await page.evaluate(()=>{const rect=selector=>{const n=document.querySelector(selector),r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,visible:!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'};};return {shortcuts:rect('#world-quick-toolbar'),header:rect('#top > summary'),expanded:document.querySelector('#top').open,overflow:document.documentElement.scrollWidth>innerWidth,startup:window.hblWorldStartup,model:window.hblSimulationModel};});const a=boxes.shortcuts,b=boxes.header,overlap=a.visible&&b.visible&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 await save(info,'world-390-header',{...boxes,overlap,errors});await page.screenshot({path:info.outputPath('world-390-expanded-header.png'),fullPage:true});expect(boxes.expanded).toBe(true);expect(overlap).toBe(false);expect(boxes.overflow).toBe(false);expect(errors).toEqual({page:[],console:[]});
});
