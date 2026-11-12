import {test,expect} from '@playwright/test';

test('Month 0 remains inspectable and configurable during slow or failed initialization',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let release;const held=new Promise(resolve=>release=resolve);
 await page.route('**/api/city-experiments',async route=>{await held;await route.fulfill({status:503,body:'Model temporarily unavailable'});});
 await page.goto('/world/future-machine.html?demo=1');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status)).toBe('loading');
 const snapshot=await page.evaluate(()=>({state:window.futureMachine.state,history:window.futureMachine.history}));
 expect(snapshot.history).toBeNull();expect(snapshot.state.preview).toBe(true);expect(snapshot.state.month).toBe(0);expect(snapshot.state.diff).toBeNull();
 expect(snapshot.state.frame.baseline.state).toEqual(snapshot.state.frame.plan.state);
 await expect(page.locator('.fm-run-provenance')).toContainText('INITIAL SNAPSHOT');
 await expect(page.getByRole('slider').first()).toBeDisabled();
 await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
 const policy=page.locator('select').filter({has:page.locator('option[value="baseline"]')});
 await policy.selectOption('baseline');
 expect(await page.evaluate(()=>window.futureMachine.state.recipe.intervention)).toBeNull();
 await page.locator('[aria-label="Synchronized City comparison"] button').first().click();
 await expect(page.locator('.fm-story')).toContainText('Initial snapshot');
 release();await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.status)).toBe('error');
 await expect(page.getByRole('button',{name:'Fork City',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>window.futureMachine.state.diff)).toBeNull();expect(errors).toEqual([]);
});
