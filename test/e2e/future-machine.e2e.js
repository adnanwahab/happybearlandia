import { test, expect } from '@playwright/test';

const ready=async page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function seek(page,month){await page.getByRole('slider').fill(String(month));await page.getByRole('slider').dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}

test('fork → run → scrub → blink → inspect → share → refresh with matched monthly City evidence',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByRole('link',{name:/Future Machine/}).first().click();
 await expect(page.getByRole('heading',{name:'Future Machine',exact:true})).toBeVisible();
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
 await page.getByRole('combobox',{name:'Policy for Future B'}).selectOption('baseline');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);
 expect(await page.evaluate(()=>window.futureMachine.state.diff.changedCount)).toBe(0);expect(await page.evaluate(()=>Object.values(window.futureMachine.state.diff.metrics).every(m=>m.delta===0))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const missing=new URL(page.url());missing.searchParams.set('experiment','city_missing_local_record');await page.goto(missing.href);await ready(page);await expect(page.getByRole('status')).toContainText('Saved record unavailable');
 await page.goto('/world/future-machine.html?fm=invalid&month=121');await expect(page.getByRole('alert')).toContainText('Invalid shared comparison');await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
});

test('WebGL fallback preserves controls and evidence',async({browser,baseURL})=>{
 const context=await browser.newContext();await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
 const page=await context.newPage();try{await page.goto(baseURL+'/world/future-machine.html');await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);await seek(page,120);await expect(page.getByRole('button',{name:/building-d1 · schematic/}).first()).toBeVisible();expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);}finally{await context.close();}
});
