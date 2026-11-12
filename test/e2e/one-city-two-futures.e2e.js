import {test, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';

// This suite always uses the locally served City API. Request interception below
// only delays real traffic; it never fulfills or substitutes model responses.
const observations=new WeakMap();
test.beforeEach(async({page})=>{
 const record={pageErrors:[],consoleErrors:[],failedRequests:[]};observations.set(page,record);
 page.on('pageerror',error=>record.pageErrors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')record.consoleErrors.push(message.text());});
 page.on('requestfailed',request=>record.failedRequests.push({url:request.url(),reason:request.failure()?.errorText}));
});
test.afterEach(async({page},info)=>{
 const record=observations.get(page);
 await mkdir(info.outputDir,{recursive:true});
 await writeFile(info.outputPath('browser-log.json'),JSON.stringify({...record,route:page.url(),viewport:page.viewportSize(),status:info.status},null,2));
 expect(record.pageErrors).toEqual([]);
});

const route='/world/future-machine.html';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function seek(page,month){const slider=page.getByTestId('future-machine-timeline');await slider.fill(String(month));await slider.dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}
async function capture(page,info,label){
 const directory=info.outputPath(label);await mkdir(directory,{recursive:true});
 const record=await page.evaluate(()=>{const {history:h,state:s,stats}=window.futureMachine;let first=null;for(let month=1;month<h.plan.length;month++){const added=h.plan[month].state.buildings.find(b=>!h.baseline[month].state.buildings.some(a=>a.id===b.id));if(added){first={month,collection:'buildings',id:added.id};break;}}return {scenario:{modelVersion:h.modelVersion,recipe:h.recipe,seed:h.seed,experimentId:h.experimentId,initialHash:h.initialHash,intervention:h.recipe.intervention,route:location.href,backend:stats.scene.backend,viewport:{width:innerWidth,height:innerHeight},browser:navigator.userAgent},metrics:{month:s.month,metrics:s.diff.metrics,firstChangedEntity:first},sameInitial:JSON.stringify(h.baseline[0].state)===JSON.stringify(h.plan[0].state),lengths:[h.baseline.length,h.plan.length]};});
 for(const name of ['scenario','metrics'])await writeFile(`${directory}/${name}.json`,JSON.stringify(record[name],null,2));
 await page.screenshot({path:`${directory}/${label}.png`,fullPage:true});return record;
}
test('record real SHE-71 homepage journey and intervention replay',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 // Hold only the outgoing real request so the transient loading UI is observable.
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/city-experiments',async request=>{await gate;await request.continue();});
 await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();await expect(page).toHaveURL(/\/world\/future-machine.html/);
 try{await expect(page.getByTestId('future-machine-timeline')).toBeDisabled();await expect(page.locator('.fm-status')).toContainText(/running|creating|loading/i);}
 finally{release();}
 await ready(page);await page.unroute('**/api/city-experiments');
 await page.getByRole('button',{name:'Pause demo',exact:true}).click();await seek(page,0);
 const start=await capture(page,info,'month-0');expect(start.sameInitial).toBe(true);expect(start.lengths).toEqual([121,121]);expect(start.scenario.seed).toBe(42);expect(start.scenario.initialHash).toBeTruthy();
 await page.getByRole('button',{name:'Resume demo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.demo.status),{timeout:70000}).toBe('complete');
 await seek(page,120);const end=await capture(page,info,'month-120');expect(end.metrics.metrics.housingUnits).toMatchObject({delta:24,unit:'homes'});
 const first=end.metrics.firstChangedEntity;expect(first).toBeTruthy();await seek(page,first.month);await capture(page,info,'first-divergence');
 await page.getByRole('button',{name:new RegExp(first.id+'.*schematic')}).last().click();
 const story=page.getByRole('region',{name:'Recorded change story'});await expect(story).toContainText(first.id);await expect(story).toContainText('PROJECT_COMPLETE');await expect(story).toContainText(start.scenario.modelVersion);await expect(story).toContainText('42');await expect(story).toContainText(String(first.month));await expect(story).toContainText(start.scenario.experimentId);await capture(page,info,'why-open');
 await seek(page,0);expect(await page.evaluate(()=>window.futureMachine.state.diff.physicalCount)).toBe(0);
 await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption('baseline');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 const zero=await capture(page,info,'no-intervention');expect(zero.scenario.intervention).toBeNull();expect(Object.values(zero.metrics.metrics).every(m=>m.delta===0)).toBe(true);expect(await page.evaluate(()=>window.futureMachine.state.diff.changedCount)).toBe(0);
 await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption('housing');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 const rerun=await capture(page,info,'rerun');expect(rerun.metrics.metrics).toEqual(end.metrics.metrics);expect(rerun.scenario.initialHash).toBe(start.scenario.initialHash);expect(errors).toEqual([]);
});
for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(`SHE-71 Canvas2D click scrub and controls ${viewport.width}`,async({page},info)=>{
 await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(route+'?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,0);await capture(page,info,'month-0');await seek(page,16);
 const record=await capture(page,info,'first-divergence');expect(record.scenario.backend).toBe('canvas2d');
 const canvas=page.locator('canvas').first();await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();// Canvas diagnostics do not expose hit targets. Project the actual recorded
 // building using the renderer's public mapping and camera, then click pixels.
 const target=await page.evaluate(async()=>{
  const {createSpatialMapping}=await import('/world/future-machine/scene/mapping.js');
  const {canvasPoint,canvasViewports}=await import('/world/future-machine/scene/canvas-stage.js');
  const {history:h,state:s,stats}=window.futureMachine;const mapping=createSpatialMapping();
  for(let m=0;m<=120;m++)mapping.frame(h.baseline[m].state,h.plan[m].state);
  const row=mapping.frame(h.baseline[s.month].state,h.plan[s.month].state).b.find(r=>r.id==='building-project-policy-1-0');
  if(!row)return null;const bounds=document.querySelector('canvas').getBoundingClientRect();
  return canvasPoint(row.x,row.z,stats.scene.camera,canvasViewports(bounds.width,bounds.height,'split')[1]);
 });expect(target).toBeTruthy();await page.mouse.click(box.x+target.x,box.y+target.y);
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');await capture(page,info,'why-open');await seek(page,120);await capture(page,info,'canvas2d');await seek(page,0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const control of [page.getByTestId('future-machine-timeline'),page.getByRole('button',{name:'Fork City',exact:true})]){await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})).toBe(true);}
 expect(errors).toEqual([]);
});
test('SHE-71 actual network failure, loading explanation and retry',async({page,context})=>{
 await page.goto(route+'?renderer=canvas2d');
 // Delay the real request, without inventing any API response or model result.
 let release;let reached;const requestSeen=new Promise(resolve=>reached=resolve);const gate=new Promise(resolve=>release=resolve);await page.route('**/api/city-experiments',async request=>{reached();await gate;await request.continue();});
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect(page.getByTestId('future-machine-seed')).toBeDisabled();await expect(page.getByTestId('future-machine-timeline')).toBeDisabled();await expect(page.locator('.fm-status')).toContainText(/running|creating|loading/i);
 await requestSeen;await context.setOffline(true);release();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();await context.setOffline(false);await page.unroute('**/api/city-experiments');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
});
