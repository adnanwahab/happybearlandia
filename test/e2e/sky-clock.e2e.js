import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`World sky clock preserves committed state · ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1200,height:800});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world?demo=1&synthetic=1&people=16');await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 await page.evaluate(()=>{window.hblSimulationPlayback.pause();window.hblSkyClock.update(performance.now(),true);});
 await page.locator('#top').evaluate(el=>el.open=true);
 const panel=page.getByTestId('sky-clock');await panel.locator('summary').click();
 await expect(panel).toContainText('No hourly recorded state');
 const before=await page.locator('#clock').innerText(),committed=await panel.locator('[data-committed]').innerText();
 const slider=panel.getByRole('slider');await slider.focus();await page.keyboard.press('End');
 await expect(panel.locator('output')).toContainText('Cosmetic lighting preview');
 expect(await slider.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
 if(mobile){const box=await slider.boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);}
 await expect.poll(()=>page.evaluate(()=>window.hblCityRenderer.timeOfDay)).not.toBeUndefined();
 await panel.getByRole('button',{name:'Reset to committed time'}).click();
 await expect(panel.locator('output')).toContainText('Current scene lighting');
 expect(await page.locator('#clock').innerText()).toBe(before);expect(await panel.locator('[data-committed]').innerText()).toBe(committed);
 expect(await page.evaluate(()=>window.hblCityRenderer.timeOfDay)).toBeUndefined();
 await page.screenshot({path:test.info().outputPath(`${mobile?'mobile':'desktop'}-sky-clock.png`)});
});
test('control failure, missing clock, throttling and teardown',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {mountSkyClock}=await import('/world/sky-clock/controls.js');let minute=60,hour,fail=false,t=0;
  const panel=mountSkyClock(document.body,{now:()=>++t,read:()=>({minute,hour}),preview:value=>{if(fail)throw Error('fixture');hour=value;},reset:()=>{hour=undefined;}});
  const input=panel.element.querySelector('input'),button=panel.element.querySelector('button');
  fail=true;input.value='22';input.dispatchEvent(new Event('input'));const failure=panel.element.querySelector('[role=status]').textContent;
  fail=false;input.dispatchEvent(new Event('input'));const success=hour===22;
  button.click();const reset=hour===undefined;
  minute=NaN;panel.update(1000);const unavailable=input.disabled&&button.disabled;
  const count=panel.getStats().updates;panel.update(1001);const throttled=panel.getStats().updates===count;
  panel.destroy();input.dispatchEvent(new Event('input'));panel.update(2000);
  return{failure,success,reset,unavailable,throttled,stats:panel.getStats(),removed:!panel.element.isConnected,hour};
 });
 expect(result.failure).toContain('failed');expect(result.success&&result.reset&&result.unavailable&&result.throttled&&result.removed).toBe(true);expect(result.stats.failures).toBe(1);expect(result.stats.disposed).toBe(true);expect(result.hour).toBeUndefined();
});
