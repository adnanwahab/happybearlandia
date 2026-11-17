import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
test('normal World exposes actual current trips and renders selected mode marker',async({page})=>{
 await page.goto('/world?source=none&seed=42&living=1');
 await page.waitForFunction(()=>window.hblLivingWorld?.getRuntime()?.getSnapshot()?.visibleAgents?.length>0);
 const evidence=await page.evaluate(async()=>{
  const host=window.hblLivingWorld,runtime=host.getRuntime();runtime.pause();
  await runtime.stepToTime(480);
  const frame=runtime.getSnapshot(),row=frame.visibleAgents.find(row=>row.trip&&['car','bus','rail'].includes(row.mode));
  if(!row)throw Error('No executed vehicle-mode trip at tested morning tick');
  await host.selectPerson(row.id);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return {row,stats:host.getRenderStats(),minute:frame.minute};
 });
 expect(evidence.row.trip.remainingMinutes).toBeGreaterThan(0);expect(evidence.stats.vehicles).toBeGreaterThan(0);
 await expect(page.locator('[data-testid=living-person]')).toBeVisible();
 await expect(page.locator('[data-lc-follow]')).toHaveText('Follow person');
 await page.locator('[data-lc-follow]').click();await expect(page.locator('[data-lc-follow]')).toHaveText('Stop following');
});

test('journey frames support keyboard and touch with reduced motion and preserve the clock',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/world?source=none&seed=42&living=1');
 await page.waitForFunction(()=>window.hblLivingWorld?.getRuntime()?.getSnapshot()?.visibleAgents?.length>0);
 const receipt=await page.evaluate(async()=>{
  const host=window.hblLivingWorld,runtime=host.getRuntime();runtime.pause();await runtime.stepToTime(480);
  const row=runtime.getSnapshot().visibleAgents.find(row=>row.trip&&row.trip.remainingMinutes>4);
  if(!row)throw Error('No supported trip with enough remaining minutes');
  await host.selectPerson(row.id);
  await runtime.step();await runtime.step();
  return {id:row.id,minute:runtime.getSnapshot().minute,run:runtime.getSnapshot().runtime.id};
 });
 const panel=page.getByTestId('journey-trail');await expect(panel).toBeVisible();
 const samples=panel.getByRole('button');expect(await samples.count()).toBeGreaterThanOrEqual(2);
 await samples.first().focus();await page.keyboard.press('Enter');
 await expect(samples.first()).toHaveAttribute('aria-pressed','true');
 await expect(panel.locator('output')).toContainText(receipt.id);await expect(panel.locator('output')).toContainText(receipt.run);
 await samples.last().tap();await expect(samples.last()).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>window.hblLivingWorld.getRuntime().getSnapshot().minute)).toBe(receipt.minute);
 await page.getByRole('button',{name:'Close person details',exact:true}).click();
 await expect(panel).toBeHidden();
 await page.evaluate(async()=>{const host=window.hblLivingWorld;const row=host.getRuntime().getSnapshot().visibleAgents.find(p=>!p.trip);if(!row)throw Error('No stationary resident');await host.selectPerson(row.id);});
 await expect(panel.locator('output')).toContainText('Journey positions unavailable');
 await expect(panel.getByRole('button')).toHaveCount(0);
});
