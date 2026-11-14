import {test,expect} from '@playwright/test';
import {openEditableHouse,houseState} from './house-edit-fixture.js';
test.use({hasTouch:true});
test('object discovery cycles by keyboard, clears selection, supports touch and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const fixture=await openEditableHouse(page),before=await houseState(page),select=page.getByRole('combobox',{name:'Explore objects',exact:true}),marker=page.locator('.house-discovery-marker');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-546-house-before.png'});
 const couch=before.household.house.objects.find(object=>object.type==='couch');
 await select.selectOption(couch.id);await select.focus();await expect(marker).toBeVisible();await expect(marker).toHaveAttribute('data-object-id',couch.id);
 expect(await marker.evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-546-house-after.png'});
 await select.press('ArrowDown');await expect(marker).not.toHaveAttribute('data-object-id',couch.id);
 await select.selectOption(couch.id);await expect(marker).toBeVisible();
 await page.getByRole('button',{name:'Inspect object',exact:true}).click();await expect(page.getByRole('dialog',{name:'Household requests'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(marker).toBeHidden();
 const after=await houseState(page);expect(after.snapshot.minute).toBe(before.snapshot.minute);expect(after.household.house.actions).toEqual(before.household.house.actions);
 // Touch uses the normal canvas pick path and opens the same command menu.
 const point=after.scene.objectScreenPositions.find(row=>row.id===couch.id);
 await page.touchscreen.tap(point.x,point.y);await expect(page.getByRole('dialog',{name:'Household requests'})).toBeVisible();
});
