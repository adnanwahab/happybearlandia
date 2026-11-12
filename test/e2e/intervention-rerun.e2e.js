import {test,expect} from '@playwright/test';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
const identity=page=>page.evaluate(async()=>{
 const h=window.futureMachine.history;
 const {stateHash}=await import('/world/future-machine/data/core.js');
 return {id:h.experimentId,recipe:h.recipe,initialHash:h.initialHash,baselineHash:await stateHash(h.baseline),homes:h.plan[120].metrics.housingUnits-h.baseline[120].metrics.housingUnits};
});
test('edit housing amount and rerun preserves the original baseline and share identity',async({page},testInfo)=>{
 await page.goto('/world/future-machine.html?renderer=canvas2d');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const original=await identity(page),url=page.url();expect(original.homes).toBe(24);
 const amount=page.getByRole('spinbutton',{name:'Proposed homes for next run'});
 await amount.fill('121');await expect(amount).toHaveAttribute('aria-invalid','true');
 await page.getByRole('button',{name:'Fork City',exact:true}).click();expect((await identity(page)).id).toBe(original.id);
 await amount.fill('12');
 const slider=page.getByTestId('future-machine-timeline');await slider.fill('120');await slider.dispatchEvent('input');
 await expect(amount).toHaveValue('12');expect(await identity(page)).toEqual(original);
 expect(new URL(page.url()).searchParams.get('fm')).toBe(new URL(url).searchParams.get('fm'));
 await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);
 const edited=await identity(page);expect(edited.id).not.toBe(original.id);expect(edited.homes).toBe(12);
 expect(edited.initialHash).toBe(original.initialHash);expect(edited.baselineHash).toBe(original.baselineHash);
 expect(edited.recipe).toEqual({...original.recipe,intervention:{...original.recipe.intervention,amount:12}});
 await slider.fill('120');await slider.dispatchEvent('input');
 await page.screenshot({path:testInfo.outputPath('edited-housing-comparison.png'),fullPage:true});
 await page.reload();await ready(page);expect(await identity(page)).toEqual(edited);await expect(amount).toHaveValue('12');
});
