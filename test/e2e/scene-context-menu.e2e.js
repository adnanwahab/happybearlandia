import {test,expect} from '@playwright/test';
test('hold suppresses release/click; actions, disabled reasons and keyboard alternatives',async({page})=>{
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 await page.evaluate(async()=>{
  const {mountSceneContextMenu}=await import('/world/scene-context-menu.js');
  document.body.replaceChildren();const canvas=document.createElement('canvas');canvas.width=600;canvas.height=400;canvas.tabIndex=0;document.body.append(canvas);
  window.clicks=0;window.actions=0;const selected={key:'fixture:1',label:'Disposable object',actions:[{label:'Inspect',run:()=>window.actions++},{label:'Restock',reason:'No stock capacity',run:()=>window.actions+=100}]};
  mountSceneContextMenu({canvas,resolve:()=>selected,readSelection:()=>selected});
  canvas.addEventListener('pointerup',()=>window.clicks++);canvas.addEventListener('click',()=>window.clicks++);
  const link=document.createElement('link');link.rel='stylesheet';link.href='/world/scene-context-menu.css';document.head.append(link);
 });
 const canvas=page.locator('canvas');await page.mouse.move(180,180);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
 const menu=page.getByRole('dialog',{name:'Scene object actions'});await expect(menu).toBeVisible();expect(await page.evaluate(()=>clicks)).toBe(0);
 await expect(menu.getByRole('button',{name:/Restock/})).toHaveAttribute('aria-disabled','true');await expect(menu).toContainText('No stock capacity');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');expect(await page.evaluate(()=>actions)).toBe(0);
 await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(canvas).toBeFocused();
 await page.keyboard.press('Shift+F10');await expect(menu).toBeVisible();await page.keyboard.press('Enter');expect(await page.evaluate(()=>actions)).toBe(1);
 await page.getByRole('button',{name:'Object actions',exact:true}).click();await menu.getByRole('button',{name:'Use conventional menu'}).click();await expect(menu).toHaveAttribute('data-layout','list');
 await page.screenshot({path:test.info().outputPath('conventional.png')});
 await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Object actions',exact:true}).click();await expect(menu).toHaveAttribute('data-layout','list');
});
test('drag and cancellation do not open a menu',async({page})=>{
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 await page.waitForFunction(()=>window.hblWorldStartup?.readyMs);
 const canvas=page.locator('canvas').first();await canvas.dispatchEvent('pointerdown',{button:0,pointerId:99,clientX:300,clientY:300});await canvas.dispatchEvent('pointermove',{pointerId:99,clientX:330,clientY:300});await page.waitForTimeout(650);await expect(page.getByRole('dialog',{name:'Scene object actions'})).toBeHidden();
 await canvas.dispatchEvent('pointerdown',{button:0,pointerId:99,clientX:300,clientY:300});await canvas.dispatchEvent('pointercancel');await page.waitForTimeout(650);await expect(page.getByRole('dialog',{name:'Scene object actions'})).toBeHidden();
});
