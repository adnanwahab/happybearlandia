import {test,expect} from '@playwright/test';
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
