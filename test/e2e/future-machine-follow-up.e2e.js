import {test,expect} from '@playwright/test';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function end(page){const slider=page.getByRole('slider').first();await slider.fill('120');await slider.dispatchEvent('input');}
test('optional revision can be dismissed or accepted with a matched starting city',async({page})=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const panel=page.getByRole('region',{name:'Optional follow-up policy'});
 await expect(panel).toBeHidden();await end(page);await expect(panel).toBeVisible();
 await expect(panel).toContainText('500,000');
 const before=await page.evaluate(()=>({id:futureMachine.history.experimentId,hash:futureMachine.history.initialHash,recipe:futureMachine.history.recipe,baseline:futureMachine.history.baseline.map(s=>s.metrics)}));
 await panel.getByRole('button',{name:'Keep this result'}).click();await expect(panel).toBeHidden();
 expect(await page.evaluate(()=>futureMachine.history.experimentId)).toBe(before.id);
 await page.reload();await ready(page);await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Accept and rerun'}).click();
 await expect.poll(()=>page.evaluate(()=>futureMachine.history.experimentId)).not.toBe(before.id);await ready(page);
 const after=await page.evaluate(()=>({hash:futureMachine.history.initialHash,recipe:futureMachine.history.recipe,baseline:futureMachine.history.baseline.map(s=>s.metrics)}));
 expect(after.hash).toBe(before.hash);expect(after.baseline).toEqual(before.baseline);
 expect(after.recipe).toEqual({...before.recipe,intervention:{...before.recipe.intervention,amount:36,cost:1500000}});
});
