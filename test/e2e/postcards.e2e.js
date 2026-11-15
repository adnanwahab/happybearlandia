import {test,expect} from '@playwright/test';
import {DEFAULT_RECIPE} from '../../world/future-machine/contracts.js';
const card = page => page.locator('[data-experience-id="future-machine"]');
test('keyboard opens supported preset through the real destination',async({page})=>{
 await page.goto('/routes');
 const button=card(page).getByRole('button',{name:/New Experiment/});
 await button.focus();await expect(button).toBeFocused();await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/future-machine.html\?fm=/);
 await expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
 expect(await page.evaluate(()=>window.futureMachine.history.recipe)).toEqual(DEFAULT_RECIPE);
 expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(0);
});
test('hover, cancellation and foreign drops never launch; a completed local drop does',async({page})=>{
 await page.goto('/routes');
 const transfer=await page.evaluateHandle(()=>new DataTransfer());
 await card(page).dispatchEvent('dragstart',{dataTransfer:transfer});
 await page.locator('.start').dispatchEvent('dragover',{dataTransfer:transfer});
 await expect(page).toHaveURL(/\/routes$/);
 await page.keyboard.press('Escape');
 await page.locator('.start').dispatchEvent('drop',{dataTransfer:transfer});
 await expect(page).toHaveURL(/\/routes$/);
 await card(page).dispatchEvent('dragstart',{dataTransfer:transfer});
 await page.locator('.start').dispatchEvent('drop',{dataTransfer:transfer});
 await expect(page).toHaveURL(/future-machine.html\?fm=/);
});
test('unsupported click/drop explains why and moves focus; reduced motion mobile stays usable',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await page.goto('/routes');
 const unsupported=page.locator('[data-experience-id="houston-map"]');
 await unsupported.getByRole('button',{name:/New Experiment/}).click();
 await expect(page.locator('#postcard-status')).toContainText('no validated experiment preset');
 await expect(page.locator('#postcard-status')).toBeFocused();
 const transfer=await page.evaluateHandle(()=>new DataTransfer());
 await unsupported.dispatchEvent('dragstart',{dataTransfer:transfer});await page.locator('.start').dispatchEvent('drop',{dataTransfer:transfer});
 await expect(page).toHaveURL(/\/routes$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.start').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('postcard-mobile.png')});
});
