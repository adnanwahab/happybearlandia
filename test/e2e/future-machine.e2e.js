import { test, expect } from '@playwright/test';

const ready=async page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function seek(page,month){await page.getByTestId('future-machine-timeline').fill(String(month));await page.getByTestId('future-machine-timeline').dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}

test('fork → run → scrub → blink → inspect → share → refresh with matched monthly City evidence',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByRole('link',{name:/Future Machine/}).first().click();
 await expect(page.getByRole('heading',{name:'One City, Two Futures',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const result=await page.evaluate(()=>{const h=window.futureMachine.history;return {lengths:[h.baseline.length,h.plan.length],months:[h.baseline[0].month,h.plan.at(-1).month],sameInitial:JSON.stringify(h.baseline[0].state)===JSON.stringify(h.plan[0].state),seed:h.seed,version:h.modelVersion,hash:h.initialHash,id:h.experimentId};});
 expect(result.lengths).toEqual([121,121]);expect(result.months).toEqual([0,120]);expect(result.sameInitial).toBe(true);expect(result.hash).toBeTruthy();
 await expect(page.getByText('No physical building or link difference recorded at this month.',{exact:true})).toBeVisible();
 await seek(page,120);
 const final=await page.evaluate(()=>({metrics:window.futureMachine.state.diff.metrics,physical:window.futureMachine.state.diff.physicalCount}));
 expect(final.metrics.housingUnits.delta).toBe(24);expect(final.physical).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Blink: Future A',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.mode)).toBe('plan');
 await page.getByRole('button',{name:'Side by side',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.mode)).toBe('split');
 await seek(page,0);await page.getByRole('button',{name:'Show Me What Changed',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBeGreaterThan(0);
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-project-policy-1-0');
 await page.getByRole('button',{name:/building-d1 · schematic/}).last().click();await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-d1');
 await seek(page,120);await page.getByRole('button',{name:'Share comparison',exact:true}).click();const link=await page.getByRole('link',{name:'Open comparison link'}).getAttribute('href');
 expect(link).toContain('fm=');expect(link).toContain('month=120');
 const before=await page.evaluate(()=>window.futureMachine.state.diff.metrics);
 await page.reload();await ready(page);expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(120);expect(await page.evaluate(()=>window.futureMachine.history.experimentId)).toBe(result.id);expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics)).toEqual(before);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export evidence',exact:true}).click();const download=await downloadPromise;await download.saveAs(testInfo.outputPath('future-machine-evidence.json'));
 await page.screenshot({path:testInfo.outputPath('future-machine-2036.png'),fullPage:true});
 console.log('FUTURE_MACHINE_MEASUREMENTS',JSON.stringify(await page.evaluate(()=>({timings:window.futureMachine.stats,heap:performance.memory?.usedJSHeapSize,resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.transferSize,durationMs:r.duration}))}))));
 expect(errors).toEqual([]);
});

test('zero diff, invalid URL, missing saved record and narrow-screen journey',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/world/future-machine.html');
 await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption('baseline');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 expect(await page.evaluate(()=>window.futureMachine.state.diff.changedCount)).toBe(0);expect(await page.evaluate(()=>Object.values(window.futureMachine.state.diff.metrics).every(m=>m.delta===0))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const missing=new URL(page.url());missing.searchParams.set('experiment','city_missing_local_record');await page.goto(missing.href);await ready(page);await expect(page.locator('.fm-status')).toContainText('Saved record unavailable');
 await page.goto('/world/future-machine.html?fm=invalid&month=121');await expect(page.getByRole('alert')).toContainText('Invalid shared comparison');await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
});

test('WebGL fallback preserves controls and evidence',async({browser,baseURL})=>{
 const context=await browser.newContext();await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
 const page=await context.newPage();try{await page.goto(baseURL+'/world/future-machine.html');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);await expect(page.getByRole('button',{name:/building-d1 · schematic/}).first()).toBeVisible();expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);}finally{await context.close();}
});

test('missing replay states and saved recipe mismatches fail explicitly',async({page})=>{
 await page.goto('/world/future-machine.html');
 await page.route('**/api/city-experiments/*/replay',async route=>{const response=await route.fetch();const body=await response.json();body.steps.pop();await route.fulfill({response,json:body});});
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await expect(page.getByRole('alert')).toContainText('expected 120 steps');await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
 await page.unroute('**/api/city-experiments/*/replay');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const mismatch=new URL(page.url());const {decodeRecipe,encodeRecipe}=await import('../../world/future-machine/share/index.js');const recipe=decodeRecipe(mismatch.searchParams.get('fm'));recipe.seed++;mismatch.searchParams.set('fm',encodeRecipe(recipe));await page.goto(mismatch.href);await expect(page.getByRole('alert')).toContainText('does not match');
});

test('40-second demo tour',async({page},testInfo)=>{
 test.skip(!process.env.HBL_RECORD_DEMO,'Set HBL_RECORD_DEMO=1 to capture the demo.');
 await page.goto('/world/future-machine.html');
 const started=Date.now();
 const hold=async target=>{const ms=target-(Date.now()-started);if(ms>0)await page.waitForTimeout(ms);};
 await hold(4000);await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await hold(7000);
 await page.getByTestId('future-machine-timeline').scrollIntoViewIfNeeded();
 for(let month=0;month<=120;month+=6){await seek(page,month);await page.waitForTimeout(350);}
 await page.locator('.fm-stage').scrollIntoViewIfNeeded();
 for(let i=0;i<4;i++){await page.getByRole('button',{name:/^Blink: Future/}).click();await page.waitForTimeout(700);}
 await page.getByRole('button',{name:'Side by side',exact:true}).click();await seek(page,0);
 await page.getByRole('button',{name:'Show Me What Changed',exact:true}).click();await page.waitForTimeout(1000);await page.getByRole('button',{name:'Show Me What Changed',exact:true}).click();
 await page.locator('.fm-stage').scrollIntoViewIfNeeded();await hold(25000);
 await seek(page,120);await page.getByRole('button',{name:/building-project-policy-1-0 · schematic/}).last().click();await page.getByRole('region',{name:'Recorded change story'}).scrollIntoViewIfNeeded();
 await page.getByText(/^Recorded model events \(/).click();await hold(32000);
 await page.getByRole('button',{name:'Share comparison',exact:true}).click();await page.getByRole('link',{name:'Open comparison link'}).scrollIntoViewIfNeeded();await hold(36000);
 await page.locator('.fm-stage').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('future-machine-thumbnail.png')});await hold(40000);
 await testInfo.attach('final-comparison-url',{body:page.url(),contentType:'text/plain'});
});

test('largest supported recipe stays bounded across scrubs and releases scene resources',async({page})=>{
 const {createShareURL}=await import('../../world/future-machine/share/index.js');const {DEFAULT_RECIPE}=await import('../../world/future-machine/contracts.js');
 const url=createShareURL({recipe:{...DEFAULT_RECIPE,households:120},month:0},'http://127.0.0.1:39884/world/future-machine.html');await page.goto(url);await ready(page);
 const max=await page.evaluate(async()=>{const slider=document.querySelector('input[type=range]');let max=0;for(let repeat=0;repeat<2;repeat++)for(let month=0;month<=120;month+=12){slider.value=month;slider.dispatchEvent(new Event('input'));max=Math.max(max,window.futureMachine.stats.scene.objects);}return max;});
 expect(max).toBeLessThanOrEqual(10);console.log('FUTURE_MACHINE_UPPER_BOUND',JSON.stringify(await page.evaluate(()=>({timings:window.futureMachine.stats,heap:performance.memory?.usedJSHeapSize,historyBytes:JSON.stringify(window.futureMachine.history).length,maxObjects:10}))));
 await page.goto('/world/future-machine.html?fm=invalid&month=121');await page.goBack({waitUntil:'domcontentloaded'});await ready(page);expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(120);
 await page.evaluate(()=>window.futureMachine.dispose());expect(await page.evaluate(()=>window.futureMachine.stats.scene.objects)).toBe(0);expect(await page.locator('.fm-ui').count()).toBe(0);
});

for(const delay of [3000,30000])test(`progressive readiness with Three delayed ${delay}ms`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const releaseAt=Date.now()+delay;
 await page.route('**/vendor/three/**',async route=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,releaseAt-Date.now())));await route.continue().catch(()=>{});});
 await page.goto('/world/future-machine.html?renderer=webgl',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 // Data readiness must expose every normal entry point without waiting for imports.
 const started=Date.now();
 await expect(page.getByTestId('future-machine-timeline')).toBeEnabled({timeout:1000});
 await expect(page.getByRole('button',{name:'Share comparison',exact:true})).toBeEnabled({timeout:1000});
 await page.getByRole('button',{name:'Play timelapse',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause timelapse',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Pause timelapse',exact:true}).click();
 await seek(page,120);
 expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);
 await page.getByRole('button',{name:/WHY.*homes/i}).click();
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('WHY');
 expect(Date.now()-started).toBeLessThan(1000);
 await page.getByRole('button',{name:/building-d1 · schematic/}).last().click();
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe(delay>10000?'canvas2d':'webgl');
 expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(120);
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-d1');
 const camera=await page.evaluate(()=>window.futureMachine.stats.scene.camera);
 if(delay>10000)await page.waitForTimeout(21000);
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.camera)).toEqual(camera);
 expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(120);
 expect(errors).toEqual([]);
});

test('blocked Three and all contexts unavailable preserve inventory and WHY',async({page})=>{
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
 await page.route('**/vendor/three/**',route=>route.abort());
 await page.goto('/world/future-machine.html');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 await expect(page.getByText('Graphics unavailable. The exact recorded inventory, timeline, outcomes and WHY controls remain available below.')).toBeVisible();
 await page.getByRole('button',{name:/building-d1 · schematic/}).last().click();
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-d1');
 await page.getByRole('button',{name:/WHY.*homes/i}).click();
 await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('WHY');
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('inventory-fallback');
});
