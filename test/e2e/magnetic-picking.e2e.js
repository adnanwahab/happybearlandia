import {test,expect} from '@playwright/test';
test('crowded mobile fixture: preview, tie choice, Escape and keyboard with reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/world/government/index.html');
 await page.evaluate(async()=>{
 const {rankScreenTargets,mountPickPreview}=await import('/world/render/magnetic-picking.js');
 document.body.replaceChildren();const canvas=document.createElement('canvas');canvas.width=390;canvas.height=600;canvas.style.cssText='position:fixed;inset:0;width:390px;height:600px;background:#24343c';document.body.append(canvas);
 const ctx=canvas.getContext('2d');for(const x of [187,203]){ctx.fillStyle='#ffe184';ctx.fillRect(x-2,298,4,4);}
 window.picks=[];window.fixturePicker=mountPickPreview(canvas,{rank:(x,y)=>rankScreenTargets({x,y,rect:canvas.getBoundingClientRect(),hitAt:(px,py)=>Math.abs(py-300)<2&&Math.abs(px-187)<3?{key:'source-person',label:'Person source-person'}:Math.abs(py-300)<2&&Math.abs(px-203)<3?{key:'source-building',label:'Building source-building'}:null}),onPick:hit=>picks.push(hit.key)});
 });
 const canvas=page.locator('canvas');await page.mouse.move(195,300);await expect(page.locator('[data-pick-preview]')).toBeVisible();
 await page.touchscreen.tap(195,300);const dialog=page.getByRole('dialog',{name:'Choose city entity'});await expect(dialog).toBeVisible();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-445-crowded-mobile.png'});
 await page.getByRole('button',{name:'Person source-person',exact:true}).click();expect(await page.evaluate(()=>picks)).toEqual(['source-person']);await expect(canvas).toBeFocused();
 await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(canvas).toBeFocused();
 await page.keyboard.press('Enter');await page.keyboard.press('Enter');expect(await page.evaluate(()=>picks.length)).toBe(2);
});
test('normal World entry mounts accessible picking without model edits',async({page})=>{
 await page.goto('/world?renderer=webgl&demo=1&synthetic=1&people=16&seed=445');
 const canvas=page.getByLabel('City scene. Press Enter to inspect near the center; Tab through choices.',{exact:true});await expect(canvas).toBeVisible();
 await page.screenshot({path:'.mini-symphony-evidence/SHE-445-after-desktop-world.png'});
});
