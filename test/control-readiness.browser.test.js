import {test,expect} from 'bun:test';

test.skipIf(!process.env.HBL_FM_BROWSER)('plan and storm loading, prerequisites and failure recovery clear stale reasons',async()=>{
 const {chromium}=await import(process.env.HBL_PLAYWRIGHT_MODULE || '@playwright/test');
 const root=new URL('../',import.meta.url).pathname;
 const server=Bun.serve({port:0,fetch(request){const path=new URL(request.url).pathname;return new Response(Bun.file(root+path));}});
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();const origin=`http://127.0.0.1:${server.port}`;
  await page.goto(origin+'/world/plan.html');
  await page.waitForSelector('.world-control-readiness:visible');
  expect(await page.locator('#run').getAttribute('aria-description')).toContain('Dear Congress');
  let release;
  await page.route('**/api/world/experiments',async route=>{await new Promise(r=>release=r);await route.fulfill({status:500,json:{error:'Test service unavailable'}});});
  await page.goto(origin+'/world/plan.html?package=Balanced&autorun=0');
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.querySelector('#run').getAttribute('aria-description')?.includes('Wait for results'));
  expect(await page.locator('.world-control-readiness').innerText()).toContain('Simulating');
  release();
  await page.waitForFunction(()=>!document.querySelector('#run').disabled);
  expect(await page.locator('#status').innerText()).toContain('Select Simulate to retry');
  expect(await page.locator('#run').getAttribute('aria-description')).toBeNull();
  expect(await page.locator('.world-control-readiness').isHidden()).toBe(true);
  await page.unroute('**/api/world/experiments');
  await page.route('**/api/world/experiments',route=>route.fulfill({status:500,json:{error:'Retry reached service'}}));
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Retry reached service'));
  expect(await page.locator('#run').isEnabled()).toBe(true);
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));
  await page.goto(origin+'/world/storm/index.html');
  await page.waitForFunction(()=>document.querySelector('#run-status').textContent.includes('Matched storms ready'));
  await page.locator('#preset').click();
  await page.waitForFunction(()=>document.querySelector('#save').hasAttribute('aria-description'));
  expect(await page.locator('#save').getAttribute('aria-description')).toContain('Run matched storms');
  await page.screenshot({path:'/private/tmp/she-16-disabled-storm.png',fullPage:true});
  await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('#save').disabled);
  expect(await page.locator('#save').getAttribute('title')).toBeNull();
  expect(await page.locator('.world-control-readiness').isHidden()).toBe(true);
 }finally{await browser?.close();server.stop(true);}
},30000);
