import {test,expect} from '@playwright/test';

const events=page=>page.evaluate(()=>window.futureMachine.firstPlayEvents);
async function ready(page){await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');}
async function seek(page,month){const slider=page.getByTestId('future-machine-timeline');await slider.fill(String(month));await slider.dispatchEvent('input');}

test('real UI milestones are first-only across timeline and demo replay; shared entry is explicit',async({page,context})=>{
 await context.grantPermissions(['clipboard-write','clipboard-read']);
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await expect.poll(async()=> (await events(page)).length).toBe(1);
 expect((await events(page))[0].event.type).toBe('landing');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await seek(page,0);
 expect((await events(page)).filter(row=>row.event.type==='first_divergence')).toHaveLength(0);
 const first=await page.evaluate(async()=>{
  const {compareHistory}=await import('/world/future-machine/diff/index.js');
  const diffs=compareHistory(window.futureMachine.history);
  return diffs.find(d=>d.month>0&&d.available&&(d.physicalCount>0||Object.values(d.metrics).some(m=>m.status==='available'&&m.delta!==0))).month;
 });
 await seek(page,first);
 await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();
 await page.getByRole('button',{name:'Share comparison',exact:true}).click();
 await expect.poll(async()=> (await events(page)).some(row=>row.event.type==='share')).toBe(true);
 const before=await events(page);
 expect(before.map(row=>row.event.type).sort()).toEqual(['landing','first_input','demo_start','first_divergence','why_opened','share'].sort());
 expect(before.find(row=>row.event.type==='share').event.payload.result).toBe('succeeded');
 const facts=before.find(row=>row.event.type==='first_divergence').event.payload.facts;
 expect(facts.month).toBe(first);expect(facts.seed).toBe(42);expect(facts.synthetic).toBe(true);
 for(const row of before){expect(row.renderer).toBe('canvas2d');expect(row.appVersion).toBe('future-machine.ui.1');expect(row.scenarioId).toBe('future-machine');}
 await seek(page,0);await seek(page,first);
 await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();
 await page.getByRole('button',{name:'Play Demo',exact:true}).click();
 await page.getByRole('button',{name:'Pause demo',exact:true}).click();
 await seek(page,first);
 expect(await events(page)).toEqual(before);
 const link=page.url();
 await page.goto(link);await ready(page);
 const returned=await events(page);
 expect(returned.filter(row=>row.event.type==='return')).toHaveLength(1);
 expect(returned.find(row=>row.event.type==='landing').event.payload.entry).toBe('shared');
 expect(returned.find(row=>row.event.type==='demo_start').event.payload.mode).toBe('saved');
 expect(returned[0].event.sessionId).not.toBe(before[0].event.sessionId);
 await seek(page,0);await seek(page,first);
 expect((await events(page)).filter(row=>row.event.type==='return')).toHaveLength(1);
});


test('failed run emits neither demo start nor invented divergence; retry remains available',async({page})=>{
 await page.route('**/api/city-experiments**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test unavailable'})}));
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await expect.poll(async()=> (await events(page)).length).toBe(1);
 await page.getByRole('button',{name:'Fork City',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status)).toBe('error');
 expect((await events(page)).map(row=>row.event.type)).toEqual(['landing','first_input']);
 await page.unroute('**/api/city-experiments**');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Clipboard unavailable'))}}));
 await page.getByRole('button',{name:'Share comparison',exact:true}).click();
 await expect.poll(async()=> (await events(page)).find(row=>row.event.type==='share')?.event.payload.result).toBe('failed');
 expect((await events(page)).filter(row=>row.event.type==='demo_start')).toHaveLength(1);
});
