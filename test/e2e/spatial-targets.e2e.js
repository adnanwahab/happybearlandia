import {test,expect} from '@playwright/test';
test('normal World semantic targets support Tab, arrows, inspection and Escape',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/area*',route=>route.abort());
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 const root=page.locator('#world-spatial-targets');
 await expect(root).toBeVisible({timeout:45000});
 await root.locator('summary').click();
 const targets=root.locator('button');await expect(targets).toHaveCount(24);
 await root.locator('summary').focus();await page.keyboard.press('Tab');await expect(targets.first()).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(targets.nth(1)).toBeFocused();
 await expect(targets.nth(1)).toHaveAttribute('data-kind','building');
 await page.screenshot({path:test.info().outputPath('spatial-building-focus.png')});
 await page.keyboard.press('Enter');await expect(page.locator('#inspect')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#inspect')).toBeHidden();
 await expect(targets.nth(1)).toBeFocused();
 await page.keyboard.press('Home');await expect(targets.first()).toBeFocused();
 await page.keyboard.press('ArrowLeft');await expect(targets.first()).toBeFocused();
 await page.keyboard.press('End');await expect(targets.last()).toBeFocused();
 await page.keyboard.press('Tab');await expect(targets.last()).not.toBeFocused();
 await targets.first().focus();await page.keyboard.press('Escape');await expect(root).not.toHaveAttribute('open','');
});
test('component empty/unavailable, touch activation, named buttons and disposal',async({page})=>{
 await page.goto('/world/?renderer=canvas2d&people=10');
 await page.evaluate(async()=>{
 const {mountSpatialTargets}=await import('/world/onboarding/spatial-targets.js');
 window.calls=[];window.rows=[];
 window.navigation=mountSpatialTargets({document,container:document.body,getTargets:()=>rows,onFocus:row=>{calls.push(row.id);return true;},onClear:()=>{},onInspect:row=>calls.push('inspect:'+row.id)});
 });
 const root=page.locator('#world-spatial-targets');await root.locator('summary').click();
 await expect(root.getByRole('status')).toContainText('unavailable');await expect(root.locator('button')).toHaveCount(0);
 await page.evaluate(()=>{rows=[{id:'source-1',name:'Alex',kind:'resident'}];navigation.refresh();});
 const button=root.getByRole('button',{name:'Alex · resident'});await button.tap();
 expect(await page.evaluate(()=>calls)).toContain('inspect:source-1');
 await page.evaluate(()=>navigation.dispose());await expect(root).toHaveCount(0);
});
