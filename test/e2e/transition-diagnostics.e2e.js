import {test,expect} from '@playwright/test';
for(const unsupported of [false,true])test(`transition receipts: ${unsupported?'unsupported':'enabled'}`,async({page},info)=>{
 if(unsupported)await page.addInitScript(()=>{document.startViewTransition=undefined;});
 await page.goto('/');
 const panel=page.locator('[data-motion-inspector]');await panel.locator('summary').focus();await page.keyboard.press('Enter');
 const preview=panel.getByRole('button',{name:'Preview transition'}),consent=panel.getByRole('checkbox',{name:/Sample transition quality/});
 const metrics=()=>panel.locator('[data-transition-metrics]').textContent().then(JSON.parse);
 await preview.click();expect((await metrics()).samples).toHaveLength(0);
 await consent.focus();await page.keyboard.press('Space');
 for(let i=0;i<20;i++){await preview.focus();await page.keyboard.press('Enter');await expect.poll(async()=>(await metrics()).samples.length).toBe(i+1);expect((await metrics()).active).toBe(0);}
 const receipt=await metrics();expect(receipt.samples.every(s=>Number.isFinite(s.durationMs)&&s.durationMs>=0)).toBe(true);
 expect(receipt.samples[0].mode).toBe(unsupported?'immediate':'native');await expect(preview).toBeFocused();
 await info.attach('20-transition-receipt',{body:JSON.stringify({browser:page.context().browser().version(),...receipt,limitations:'RAF gaps estimate 60 Hz missed opportunities. Renderer/GPU memory unavailable. Software browser is not laptop certification.'},null,2),contentType:'application/json'});
 await page.emulateMedia({reducedMotion:'reduce'});await preview.click();await expect.poll(async()=>(await metrics()).samples.at(-1).mode).toBe('reduced');
 await page.setViewportSize({width:390,height:844});await consent.tap();expect((await metrics()).samples).toHaveLength(0);
 await page.screenshot({path:info.outputPath('transition-mobile.png'),fullPage:true});
});
