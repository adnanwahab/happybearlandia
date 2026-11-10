import {test,expect} from '@playwright/test';

test('place an addition, compare paired days, inspect residents, cancel and clear',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/plan**',route=>route.fulfill({json:{packages:[]}}));
 await page.route('**/api/dear-congress/**',route=>route.fulfill({json:{packages:[]}}));
 await page.route('**/api/outcomes**',route=>route.fulfill({json:{outcomes:[]}}));
 await page.setViewportSize({width:1280,height:800});
 await page.goto('/world?demo=1&renderer=webgl&people=20&quality=LOW');
 const panel=page.getByTestId('what-if-panel');
 await page.getByTestId('what-if-open').click();await expect(panel).toBeVisible();
 await expect(panel.getByRole('button',{name:'Simulate before & after'})).toBeDisabled();
 await panel.getByRole('button',{name:'Choose on map'}).click();
 await page.locator('#view canvas').click({position:{x:600,y:420}});
 await expect(panel.locator('[data-location]')).toContainText('Proposed park');
 await panel.getByRole('button',{name:'Use view center'}).click();await expect(panel.locator('[data-location]')).toContainText('Proposed park');
 const before=await page.evaluate(()=>({population:hblLivingWorld.getSnapshot()?.population,minute:hblLivingWorld.getSnapshot()?.minute}));
 await panel.getByRole('button',{name:'Simulate before & after'}).click();
 await expect(panel.locator('[data-status]')).toContainText('Comparison complete',{timeout:90000});
 await expect(panel.locator('[data-summary]')).toContainText('200 synthetic residents');await expect(panel.locator('[data-metrics] tr')).toHaveCount(3);
 await panel.getByRole('button',{name:'Housing burden',exact:true}).click();await expect(panel.locator('[data-explanation]')).toContainText('improved');
 await panel.getByRole('button',{name:'Average commute',exact:true}).click();
 const resident=panel.locator('[data-residents] button').first();if(await resident.count()){await resident.click();await expect(panel.locator('[data-status]')).toContainText('Comparison resident');}
 await page.screenshot({path:'/private/tmp/hbl-neighborhood-what-if.png'});
 await panel.getByRole('combobox',{name:'Neighborhood addition'}).selectOption('housing');await expect(panel.locator('[data-results]')).toBeHidden();
 let releaseWorker;const workerGate=new Promise(resolve=>releaseWorker=resolve);
 await page.route('**/what-if/compare.worker.js',async route=>{await workerGate;await route.continue();});
 await panel.getByRole('button',{name:'Simulate before & after'}).click();await panel.getByRole('button',{name:'Cancel',exact:true}).click();releaseWorker();await expect(panel.locator('[data-status]')).toContainText('cancelled');
 await panel.getByRole('button',{name:'Clear',exact:true}).click();await expect(panel.getByRole('button',{name:'Simulate before & after'})).toBeDisabled();
 await panel.getByRole('button',{name:'Choose on map'}).click();await page.keyboard.press('Escape');await expect(panel.getByRole('button',{name:'Choose on map'})).toHaveAttribute('aria-pressed','false');
 await panel.getByRole('button',{name:'Close neighborhood comparison'}).click();await expect(panel).toBeHidden();
 expect(await page.evaluate(()=>hblLivingWorld.getSnapshot()?.population)).toBe(before.population);
 expect(errors).toEqual([]);
});
