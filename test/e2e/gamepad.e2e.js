import {test,expect} from '@playwright/test';
test('optional controller: camera, tour, inspection, focus and disconnect',async({page})=>{
 await page.addInitScript(()=>{window.qaPad={index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.qaPad?[window.qaPad]:[]});});
 await page.route('**/api/area*',route=>route.abort());
 await page.route('**/OrbitControls.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+'\nconst qaUpdate=OrbitControls.prototype.update;OrbitControls.prototype.update=function(...a){window.qaCamera=this;return qaUpdate.apply(this,a);};'});});
 await page.goto('/world?demo=1&synthetic=1&people=16&renderer=webgl');
 await expect(page.locator('#gamepad-controls')).toBeVisible({timeout:45000});
 await page.locator('#gamepad-controls summary').click();
 await expect(page.locator('[data-status]')).toContainText('Controller off');
 await page.locator('[data-enabled]').check();await page.locator('canvas').first().focus();
 await expect(page.locator('[data-status]')).toContainText('connected');
 const position=()=>page.evaluate(()=>qaCamera.object.position.toArray());const before=await position();
 await page.evaluate(()=>qaPad.axes[0]=1);await expect.poll(async()=>JSON.stringify(await position())).not.toBe(JSON.stringify(before));

 await page.evaluate(()=>qaPad.axes[0]=0);
 // Observe calls to existing controls without replacing their behavior.
 await page.evaluate(()=>{window.qaTourClicks=0;document.getElementById('demoBtn').addEventListener('click',()=>qaTourClicks++);});
 const press=async index=>{await page.evaluate(i=>qaPad.buttons[i].pressed=true,index);await page.waitForTimeout(100);await page.evaluate(i=>qaPad.buttons[i].pressed=false,index);await page.waitForTimeout(100);};
 await press(15);await expect.poll(()=>page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
 await press(2);await press(3);await press(1);
 await press(9);await expect.poll(()=>page.evaluate(()=>qaTourClicks)).toBe(1);
 // Stop the existing tour before measuring controller disconnect motion.
 await page.locator('#demoStop').click();
 await page.evaluate(()=>{qaPad=null;dispatchEvent(new Event('gamepaddisconnected'));});
 await expect(page.locator('[data-status]')).toContainText('No standard');
 await page.waitForTimeout(500);const stopped=await position();await page.waitForTimeout(150);expect(await position()).toEqual(stopped);
 await page.keyboard.press('ArrowRight');await page.locator('#gamepad-controls summary').focus();await page.keyboard.press('Enter');
 await page.screenshot({path:'.mini-symphony-evidence/SHE-473-after-desktop-2.png'});
});
test('unavailable API retains keyboard and touch settings',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:undefined}));
 await page.route('**/api/area*',route=>route.abort());await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
 await page.goto('/world?demo=1&synthetic=1&people=16&renderer=webgl');await page.locator('#gamepad-controls summary').click({timeout:45000});await expect(page.locator('[data-status]')).toContainText('unavailable');await page.screenshot({path:'.mini-symphony-evidence/SHE-473-after-mobile-2.png'});
});
