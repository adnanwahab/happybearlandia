import { test, expect } from '@playwright/test';

// Synthetic browsing identifiers, not a claim of cross-model entity mapping.
const scope = {universeId:'universe:test:main', worldId:'world:test:city',
  scenarioId:'scenario:test:baseline', runId:'run:test:one',
  branchId:'branch:test:fork', tick:'17', entityId:'person:test:ada'};
const budget = {nodes:100, jsEventListeners:10, documents:2, heap:16*1024*1024};
for (const realApps of [false, true]) test(`${realApps?'real apps':'isolated shell'}: fifty route hops`, async ({page}, info) => {
  const errors=[], samples=[], hops=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  if (!realApps) await page.route('**/*', route => {
    if (route.request().resourceType()==='document' && route.request().frame().parentFrame())
      return route.fulfill({contentType:'text/html', body:'<!doctype html><title>Synthetic shell fixture</title><h1>Navigation fixture; model unavailable</h1>'});
    return route.continue();
  });
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  async function counters() {
    await cdp.send('HeapProfiler.collectGarbage');
    const {metrics}=await cdp.send('Performance.getMetrics');
    return {...await cdp.send('Memory.getDOMCounters'), heap:metrics.find(m=>m.name==='JSHeapUsedSize').value};
  }
  async function checkScope() {
    const params=new URL(page.url()).searchParams;
    for(const [key,value] of Object.entries(scope)) expect(params.get(key),key).toBe(value);
    await expect(page.locator('.universe-context')).toContainText('entityId: '+scope.entityId);
  }
  async function enter(id) {
    await page.locator('#universe-search').fill(id==='future-machine'?'One City, Two Futures':id==='house'?'/world/house':'/world');
    const link=page.locator(`.universe-card a[data-app="${id}"]`);
    await link.focus(); await link.press('Enter');
    await expect(page.locator('#universe-stage iframe')).toHaveCount(1);
    await expect(page.locator('#universe-stage h3')).toBeFocused();
    await expect.poll(()=>page.locator('#universe-stage iframe').evaluate(f=>f.contentDocument?.readyState)).toBe('complete');
    if(realApps) await expect(page.frameLocator('#universe-stage iframe').getByRole('navigation',{name:'Connected universe'})).toBeAttached();
    const childURL=new URL(await page.locator('#universe-stage iframe').getAttribute('src'),page.url());
    for(const [key,value] of Object.entries(scope)) expect(childURL.searchParams.get(key),key+' child').toBe(value);
  }
  async function hop(action) {
    const start=Date.now(); await action(); await checkScope();
    hops.push({hop:hops.length+1, url:page.url(), elapsedMs:Date.now()-start});
  }
  await page.goto('/?'+new URLSearchParams(scope));
  // Warm all three destinations and return home before measuring identical states.
  for(const id of ['world','house','future-machine']) await enter(id);
  await page.getByRole('button',{name:'Close experience',exact:true}).click();
  const baseline=await counters();
  await page.screenshot({path:info.outputPath('before.png')});
  try {
    for(let loop=0;loop<10;loop++) {
      await hop(()=>enter('world'));
      await hop(()=>enter('house'));
      await hop(()=>enter('future-machine'));
      await hop(async()=>{await page.goBack(); await expect(page).toHaveURL(/app=house/); await expect(page.locator('#universe-stage h3')).toBeFocused();});
      await hop(async()=>{await page.getByRole('button',{name:'Close experience',exact:true}).click(); await expect(page.locator('#universe-stage iframe')).toHaveCount(0); await expect(page.locator('#universe-search')).toBeFocused();});
      const sample=await counters(); samples.push({loop:loop+1,...sample});
      for(const [key,allowance] of Object.entries(budget)) expect(sample[key],`${key} loop ${loop+1}`).toBeLessThanOrEqual(baseline[key]+allowance);
      expect(page.frames()).toHaveLength(1);
    }
    expect(hops).toHaveLength(50); expect(errors).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('after.png')});
  } finally {
    await info.attach('journey-evidence',{contentType:'application/json',body:JSON.stringify({realApps,browser:page.context().browser().version(),scope,budget,baseline,samples,hops,errors,
      limitations:['Post-GC CDP counters exclude GPU and total process memory.','Synthetic browsing scope is retained, not resolved into independent model clocks/IDs.','Reduced-motion phone viewport; no low-end hardware or responsiveness certification.']},null,2)});
  }
});

test('invalid and unavailable destinations recover with keyboard access',async({page})=>{
  await page.goto('/?app=house&tick=-1');
  await expect(page.getByRole('alert').filter({hasText:'Invalid context'})).toBeVisible();
  await expect(page.locator('#universe-stage iframe')).toHaveCount(0);
  await page.goto('/?app=unavailable');
  await expect(page.locator('.universe-status')).toContainText('Unknown experience');
  await expect(page.locator('#universe-search')).toBeFocused();
  await expect(page.locator('#universe-stage iframe')).toHaveCount(0);
});
