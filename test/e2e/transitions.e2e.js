import {test,expect} from '@playwright/test';
for(const reducedMotion of ['no-preference','reduce'])test(`rapid reversal and failure: ${reducedMotion}`,async({page},info)=>{
 await page.emulateMedia({reducedMotion});await page.setViewportSize({width:390,height:844});
 await page.route('**/*',route=>route.request().resourceType()==='document'&&route.request().frame().parentFrame()?route.fulfill({contentType:'text/html',body:'<h1>Local navigation fixture</h1>'}):route.continue());
 await page.goto('/?runId=run%3Atest%3Aone&tick=17');
 const enter=page.locator('a[data-app="worldline"]').first();await enter.focus();await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/app=worldline/);
 for(let i=0;i<10;i++){
  await page.locator('#universe-stage button').click();
  await expect(page).not.toHaveURL(/app=/);
  await enter.click();await expect(page).toHaveURL(/app=worldline/);
 }
 await page.goBack();await expect(page.locator('#universe-stage iframe')).toHaveCount(0);
 await page.goForward();await expect(page.locator('#universe-stage iframe')).toHaveCount(1);
 expect(new URL(page.url()).searchParams.get('runId')).toBe('run:test:one');
 expect(new URL(page.url()).searchParams.get('tick')).toBe('17');
 // Explicit missing-capability path uses the actual shared coordinator.
 expect(await page.evaluate(async()=>{
  const {createMotionAdapter}=await import('/shared/media/motion.js');let state='stable';
  const a=createMotionAdapter({document:{},preferences:{get:()=>({reducedMotion:false}),subscribe:()=>()=>{}}});
  try{await a.transition(()=>state='bad',{prepare:()=>Promise.reject(Error('missing')),rollback:()=>state='stable'});}catch{}
  await a.transition(()=>state='recovered');a.dispose();return state;
 })).toBe('recovered');
 await page.screenshot({path:info.outputPath('reversal-mobile.png')});
});
