import {test,expect} from '@playwright/test';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function start(page){await page.goto('/world/future-machine.html?renderer=canvas2d');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);}
async function month(page,n){const slider=page.getByRole('slider').first();await slider.fill(String(n));await slider.dispatchEvent('input');}
test('lost network at first divergence preserves authoritative local evidence and share',async({page,context},info)=>{
 await start(page);await month(page,16);
 const before=await page.evaluate(()=>({frame:window.futureMachine.state.frame,diff:window.futureMachine.state.diff,id:window.futureMachine.history.experimentId}));
 await context.setOffline(true);await page.getByRole('button',{name:'WHY · Homes',exact:true}).click();await page.getByRole('region',{name:'Recorded change story'}).getByRole('button',{name:/Recorded housing completion/}).first().click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('PROJECT_COMPLETE');
 await page.getByRole('button',{name:'Copy comparison link',exact:true}).click();
 expect(await page.evaluate(()=>window.futureMachine.state.frame)).toEqual(before.frame);
 expect(await page.evaluate(()=>window.futureMachine.state.diff)).toEqual(before.diff);
 await expect(page.getByText('Synthetic schematic layout', {exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect(page.getByRole('button',{name:'Retry comparison',exact:true})).toBeVisible();
 await expect(page.getByText('The previous completed run remains displayed.',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>window.futureMachine.history.experimentId)).toBe(before.id);
 await page.screenshot({path:info.outputPath('offline-first-divergence.png'),fullPage:true});
 await context.setOffline(false);await page.getByRole('button',{name:'Retry comparison',exact:true}).click();await ready(page);
});
test('interrupted shared replay retries same saved identity and month; slow stale replay cannot overwrite',async({page},info)=>{
 await start(page);await month(page,16);const url=page.url();const id=await page.evaluate(()=>window.futureMachine.history.experimentId);
 let fail=true;await page.route('**/api/city-experiments/*/replay',async route=>{if(fail)await route.abort('connectionreset');else await route.continue();});
 await page.goto(url);await expect(page.getByRole('button',{name:'Retry comparison',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.futureMachine.history)).toBeNull();await expect(page.getByRole('button',{name:'Copy comparison link',exact:true})).toBeDisabled();
 await page.screenshot({path:info.outputPath('interrupted-share-reopen.png'),fullPage:true});
 fail=false;await page.getByRole('button',{name:'Retry comparison',exact:true}).click();await ready(page);
 expect(await page.evaluate(()=>({id:window.futureMachine.history.experimentId,month:window.futureMachine.state.month,delta:window.futureMachine.state.diff.metrics.housingUnits.delta}))).toEqual({id,month:16,delta:24});
 await page.unroute('**/api/city-experiments/*/replay');let release;const gate=new Promise(resolve=>release=resolve);let entered=false;
 await page.route('**/api/city-experiments/*/replay',async route=>{entered=true;await gate;await route.continue().catch(()=>{});});
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect.poll(()=>entered).toBe(true);await page.getByRole('button',{name:'Cancel run',exact:true}).click();release();await page.unroute('**/api/city-experiments/*/replay');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);const fresh=await page.evaluate(()=>window.futureMachine.history.experimentId);expect(fresh).not.toBe(id);
 await month(page,16);expect(await page.evaluate(()=>window.futureMachine.history.experimentId)).toBe(fresh);
});
test('timed-out shared data offers retry without publishing partial history',async({page})=>{
 await start(page);const url=page.url();
 await page.clock.install();
 let release;const gate=new Promise(resolve=>release=resolve);let entered=false;
 await page.route('**/api/city-experiments/*',async route=>{entered=true;await gate;await route.continue().catch(()=>{});});
 await page.goto(url);await expect.poll(()=>entered).toBe(true);await page.clock.fastForward(180001);
 await expect(page.getByRole('alert').filter({hasText:'City data timed out'})).toBeVisible();
 expect(await page.evaluate(()=>window.futureMachine.history)).toBeNull();
 release();await page.unroute('**/api/city-experiments/*');
 await page.getByRole('button',{name:'Retry comparison',exact:true}).click();await ready(page);
});

test('network lost after shell load at share reopen retries saved pair without recomputation',async({page,context},info)=>{
 await start(page);await month(page,16);
 const url=page.url(),before=await page.evaluate(()=>({id:window.futureMachine.history.experimentId,recipe:window.futureMachine.history.recipe,hash:window.futureMachine.history.initialHash}));
 // Keep the ordinary page entry available; disconnect when its saved-data request starts.
 await page.route('**/api/city-experiments/*',async route=>{await context.setOffline(true);await route.abort('internetdisconnected');});
 await page.goto(url);await expect(page.getByRole('alert')).toContainText('connection interrupted');
 expect(await page.evaluate(()=>window.futureMachine.history)).toBeNull();
 await expect(page.getByRole('button',{name:'Copy comparison link',exact:true})).toBeDisabled();
 await page.screenshot({path:info.outputPath('offline-share-reopen.png'),fullPage:true});
 await page.unroute('**/api/city-experiments/*');await context.setOffline(false);
 await page.getByRole('button',{name:'Retry comparison',exact:true}).click();await ready(page);
 expect(await page.evaluate(()=>({id:window.futureMachine.history.experimentId,recipe:window.futureMachine.history.recipe,hash:window.futureMachine.history.initialHash}))).toEqual(before);
 expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(16);
 await expect(page.locator('.fm-status')).not.toContainText('recomputed from the versioned recipe');
});

test('slow shared replay stays loading until both arms arrive',async({page})=>{
 await start(page);await month(page,16);const url=page.url();
 let release,entered=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/city-experiments/*/replay',async route=>{if(route.request().postDataJSON().scenarioId==='plan'){entered=true;await gate;}await route.continue().catch(()=>{});});
 try {
  await page.goto(url);await expect.poll(()=>entered).toBe(true);
  expect(await page.evaluate(()=>window.futureMachine.history)).toBeNull();
  expect(await page.evaluate(()=>window.futureMachine.state.status)).toBe('loading');
  await expect(page.getByRole('button',{name:'Copy comparison link',exact:true})).toBeDisabled();
  release();await ready(page);
  expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);
 } finally {release();}
});
