import {test,expect} from '@playwright/test';
test('Canvas2D density switches model units and clears missing checkpoints',async({page},testInfo)=>{
 await page.goto('/world/bench/people');
 await page.evaluate(async()=>{
  document.body.innerHTML='<main></main>';
  const {mountPopulationDensity}=await import('/world/population/density-view.js');
  const {createPopulationModel,snapshotPopulation}=await import('/world/population/model.js');
  window.densityView=mountPopulationDensity(document.querySelector('main'));
  window.densityFrame=snapshotPopulation(createPopulationModel({population:100,representedPopulation:10000,seed:42},{buildings:[{id:'a',center:[-100,-100]},{id:'b',center:[100,100]}]}));
  densityView.setActive(true);
 });
 await page.screenshot({path:testInfo.outputPath('density-before.png')});
 await page.evaluate(()=>densityView.update(densityFrame));
 await expect(page.locator('[role=status]')).toContainText('total 10,000');
 await page.getByLabel('Density legend').selectOption('explicit');
 await expect(page.locator('[role=status]')).toContainText('total 100');
 expect(await page.locator('canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,320,320).data.some(n=>n))).toBe(true);
 await page.screenshot({path:testInfo.outputPath('density-after.png')});
 await page.evaluate(()=>densityView.update(null));
 await expect(page.locator('canvas')).toBeHidden();
 await expect(page.locator('[role=status]')).toContainText('unavailable');
});
