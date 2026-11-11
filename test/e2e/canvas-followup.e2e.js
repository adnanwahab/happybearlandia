import {test,expect} from '@playwright/test';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function seek(page,month){const slider=page.getByRole('slider');await slider.focus();await slider.press('Home');for(let i=0;i<month;i++)await slider.press('ArrowRight');await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(month);}

for(const viewport of [{width:320,height:740},{width:740,height:320}])test(`Canvas keyboard, exact selection and reduced motion ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
 await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/world/future-machine.html?renderer=canvas');await page.getByRole('button',{name:'Fork City',exact:true}).focus();await page.keyboard.press('Enter');await ready(page);
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.stats.scene.backend)).toBe('canvas2d');
 await seek(page,16);expect(await page.evaluate(()=>window.futureMachine.state.diff.metrics.housingUnits.delta)).toBe(24);
 const canvas=page.locator('.fm-stage canvas');await canvas.focus();const before=await page.evaluate(()=>window.futureMachine.stats.scene.camera);await page.keyboard.press('+');await page.keyboard.press('ArrowRight');
 const after=await page.evaluate(()=>window.futureMachine.stats.scene.camera);expect(after.zoom).toBeGreaterThan(before.zoom);expect(after.x).toBeGreaterThan(before.x);
 await page.keyboard.press('Tab');expect(await canvas.evaluate(el=>document.activeElement===el)).toBe(false);
 const target=page.getByRole('button',{name:/building-project-policy-1-0 · schematic/}).last();await target.focus();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-project-policy-1-0');
 const story=page.getByRole('region',{name:'Recorded change story'});
 await story.evaluate(el=>{window.canvasStoryChanges=0;window.canvasStoryObserver=new MutationObserver(()=>window.canvasStoryChanges++);window.canvasStoryObserver.observe(el,{childList:true,subtree:true});});
 await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await canvas.click({position:{x:box.width*.75,y:box.height*.5}});
 await expect.poll(()=>page.evaluate(()=>window.canvasStoryChanges)).toBeGreaterThan(0);await expect(story).toContainText('building-project-policy-1-0');await page.evaluate(()=>window.canvasStoryObserver.disconnect());
 const camera=await page.evaluate(()=>window.futureMachine.stats.scene.camera);await seek(page,0);await seek(page,16);expect(await page.evaluate(()=>window.futureMachine.stats.scene.camera)).toEqual(camera);
 const pixels=await canvas.evaluate(el=>el.toDataURL());await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});expect(await canvas.evaluate(el=>el.toDataURL())).toBe(pixels);
 await page.getByRole('button',{name:'Side by side',exact:true}).focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>window.futureMachine.state.mode)).toBe('split');
 await page.locator('.fm-stage').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('canvas-reduced-motion.png'),fullPage:true});await canvas.screenshot({path:testInfo.outputPath('canvas-selected-detail.png')});
 // Canvas draws only on interaction/update: selection remains visible under either media preference.
 await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('region',{name:'Recorded change story'})).toContainText('building-project-policy-1-0');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
