import {test,expect} from '@playwright/test';
for (const width of [1440,390]) test(`window card keyboard, stale frame and disposal at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world?living=1&demo=1&synthetic=1&people=16');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs,{timeout:45000});
 await page.screenshot({path:`.mini-symphony-evidence/SHE-519-after-${width}.png`});
 // Disposable, explicitly synthetic contract fixture exercises the same mounted
 // component without depending on which residents the worker samples nearby.
 await page.evaluate(async()=>{
  const {mountWindowPeeks}=await import('/world/population/window-peeks.js');
  const host=document.createElement('div');host.id='peek-fixture';host.style='position:fixed;inset:10px;z-index:99999;background:#fff;color:#000;overflow:auto';document.body.append(host);
  const frame={schemaVersion:'population-snapshot.v1',tick:7,minute:30,households:[{id:'fixture-h'}],visibleAgents:[{synthetic:true,householdId:'fixture-h',homeId:'b',locationId:'b',currentActivity:'HOME',x:0,z:0,name:'PRIVATE'}]};
  window.peekFixture={frame,api:mountWindowPeeks({container:host}),host};peekFixture.api.update(frame,{x:0,z:0},true);
 });
 const host=page.locator('#peek-fixture'),button=host.getByRole('button');await button.focus();await page.keyboard.press('Enter');
 await expect(host.getByRole('status')).toContainText('fixture-h · tick 7');await expect(host).not.toContainText('PRIVATE');
 await page.evaluate(()=>{peekFixture.frame.tick=8;peekFixture.api.update(peekFixture.frame,{x:0,z:0},true)});
 await expect(button).toBeFocused();await expect(host.getByRole('status')).toBeEmpty();await page.keyboard.press('Enter');await expect(host.getByRole('status')).toContainText('tick 8');
 await page.screenshot({path:`.mini-symphony-evidence/SHE-519-card-${width}.png`});
 await page.evaluate(()=>{for(let i=0;i<100;i++){peekFixture.frame.tick++;peekFixture.api.update(peekFixture.frame,{x:i%2?1000:0,z:0},true)}});
 await expect(host).toContainText('Opaque windows');await expect(host.getByRole('button')).toHaveCount(0);
 await page.evaluate(()=>{peekFixture.api.destroy();peekFixture.api.update(peekFixture.frame,{x:0,z:0},true)});await expect(host.locator('section')).toHaveCount(0);
 await page.goto('/');
});
