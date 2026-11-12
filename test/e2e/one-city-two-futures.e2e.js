import {test,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';

const route='/world/future-machine.html';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function seek(page,month){
 const slider=page.getByTestId('future-machine-timeline');
 await slider.fill(String(month));await slider.dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);
}
async function capture(page,info,name){
 const record=await page.evaluate(()=>{
  const {history:h,state:s,stats}=window.futureMachine;
  const first=h.plan.flatMap((snapshot,month)=>snapshot.state.buildings
   .filter(b=>!h.baseline[month].state.buildings.some(a=>a.id===b.id))
   .map(b=>({month,id:b.id,collection:'buildings'})))[0]??null;
  return {scenario:{modelVersion:h.modelVersion,recipe:h.recipe,seed:h.seed,
   experimentId:h.experimentId,initialHash:h.initialHash,intervention:h.recipe.intervention,
   route:location.href,backend:stats.scene.backend,viewport:{width:innerWidth,height:innerHeight},
   browser:navigator.userAgent,provenance:h.provenance},
   metrics:{month:s.month,values:s.diff.metrics,firstChangedEntity:first},
   sameInitial:JSON.stringify(h.baseline[0].state)===JSON.stringify(h.plan[0].state),
   lengths:[h.baseline.length,h.plan.length],scene:stats.scene};
 });
 const dir=info.outputPath(name);await mkdir(dir,{recursive:true});
 for(const key of ['scenario','metrics'])await writeFile(`${dir}/${key}.json`,JSON.stringify(record[key],null,2));
 await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true});
 return record;
}

test.beforeEach(async({page},info)=>{
 const errors=[];
 page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));
 page.on('console',m=>{if(m.type()==='error')errors.push({type:'console',message:m.text()});});
 // Keep error evidence even when an earlier assertion fails.
 info._browserErrors=errors;
});
test.afterEach(async({},info)=>{
 await writeFile(info.outputPath('browser-errors.json'),JSON.stringify(info._browserErrors,null,2));
 if(!info.title.includes('offline'))expect(info._browserErrors).toEqual([]);
});

async function inspectPair(page,info){
 await seek(page,0);const start=await capture(page,info,'month-0');
 expect(start.sameInitial).toBe(true);expect(start.lengths).toEqual([121,121]);
 expect(start.scenario.initialHash).toBeTruthy();expect(start.scenario.seed).toBe(42);
 expect(Object.values(start.metrics.values).every(m=>m.delta===0)).toBe(true);
 await seek(page,120);const end=await capture(page,info,'month-120');
 expect(end.metrics.values.housingUnits).toMatchObject({delta:24,unit:'homes'});
 const first=end.metrics.firstChangedEntity;expect(first).toBeTruthy();
 await seek(page,first.month);await capture(page,info,'first-divergence');
 const canvas=page.locator('canvas').first();await canvas.scrollIntoViewIfNeeded();
 const target=await page.evaluate(id=>window.futureMachine.stats.scene.targets.find(t=>t.id===id&&t.arm==='plan'),first.id);
 expect(target,'Changed building must have a clickable scene target').toBeTruthy();
 const box=await canvas.boundingBox();await page.mouse.click(box.x+target.x,box.y+target.y);
 const why=page.getByTestId('future-machine-why');
 await expect(why).toContainText(first.id);await expect(why).toContainText(/PROJECT_COMPLETE|unsupported|unavailable/i);
 // The metric WHY includes the exact run context alongside recorded receipts.
 await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();
 for(const value of [String(first.month),String(start.scenario.seed),start.scenario.modelVersion,start.scenario.experimentId])await expect(why).toContainText(value);
 await capture(page,info,'why-open');
 await seek(page,0);expect(await page.evaluate(()=>window.futureMachine.state.diff.physicalCount)).toBe(0);
 return end;
}

test('homepage real paired journey, changed policy and seed-matched rerun',async({page},info)=>{
 await page.goto('/');await page.getByRole('link',{name:'Play Demo',exact:true}).click();
 await expect(page).toHaveURL(/\/world\/future-machine.html/);await ready(page);
 await page.getByRole('button',{name:'Pause demo',exact:true}).click();
 const original=await inspectPair(page,info);
 await page.getByLabel('Plan',{exact:true}).selectOption('baseline');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 const control=await capture(page,info,'no-intervention');expect(control.scenario.intervention).toBeNull();
 expect(Object.values(control.metrics.values).every(m=>m.delta===0)).toBe(true);
 await page.getByLabel('Plan',{exact:true}).selectOption('housing');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 const rerun=await capture(page,info,'rerun');expect(rerun.metrics).toEqual(original.metrics);
 expect(rerun.scenario.initialHash).toBe(original.scenario.initialHash);
 expect(rerun.scenario.experimentId).not.toBe(original.scenario.experimentId);
});

for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(`Canvas2D selection, scrub and controls at ${viewport.width}x${viewport.height}`,async({page},info)=>{
 await page.setViewportSize(viewport);await page.goto(route+'?renderer=canvas');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
 await inspectPair(page,info);await seek(page,120);await capture(page,info,'canvas2d');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const control of [page.getByTestId('future-machine-timeline'),page.getByRole('button',{name:'WHY · Homes',exact:true}),page.getByRole('button',{name:'Fork City',exact:true})]){
  await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();
  expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);})).toBe(true);
 }
});

test('offline failure and real loading disabled reasons recover',async({page,context},info)=>{
 await page.goto(route+'?renderer=canvas');await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeVisible();
 await context.setOffline(true);await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect(page.getByRole('alert').filter({visible:true}).first()).toContainText(/fetch|network|offline|failed/i);
 await captureFailure();await context.setOffline(false);
 // Hold only the outgoing request to inspect actual loading UI, then pass it to
 // the real backend. No fabricated model responses or metric fixtures.
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/city-experiments',async r=>{await gate;await r.continue();});
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 try{
  await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeDisabled();
  await expect(page.getByTestId('future-machine-timeline')).toBeDisabled();
  await expect(page.locator('.fm-status')).toContainText(/creat|run|load|queue/i);
 }finally{release();}
 await ready(page);await capture(page,info,'recovered');
 async function captureFailure(){await page.screenshot({path:info.outputPath('offline.png'),fullPage:true});}
});

test('record real uncut homepage Play Demo',async({page},info)=>{
 test.skip(!process.env.HBL_RECORD_DEMO,'Run the named recording script for the real-time presentation.');
 await page.goto('/');const started=Date.now();await page.getByRole('link',{name:'Play Demo',exact:true}).click();await ready(page);
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.demo?.status),{timeout:70000,intervals:[250]}).toBe('complete');
 await writeFile(info.outputPath('timing.json'),JSON.stringify({elapsedMs:Date.now()-started}));
 await inspectPair(page,info);
 await page.goto(route+'?renderer=canvas');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
 await capture(page,info,'canvas2d');
});
