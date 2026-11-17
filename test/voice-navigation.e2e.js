import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`World voice confirmation, fallback and keyboard mobile=${mobile}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{
  window.voiceInstances=[];
  window.SpeechRecognition=class {processLocally=false;constructor(){window.voiceInstances.push(this);}start(){this.started=true;}abort(){this.aborted=true;}};
 });
 await page.goto('/world/?demo=1&synthetic=1&people=16');
 await expect(page.locator('#launch-navigation')).toBeVisible();expect(await page.evaluate(()=>window.voiceInstances.length)).toBe(0);
 await page.getByRole('button',{name:'Search / voice',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Travel and actions'}),input=dialog.getByRole('combobox');await expect(input).toBeFocused();
 await dialog.getByRole('button',{name:'Use voice',exact:true}).click();
 expect(await page.evaluate(()=>window.voiceInstances[0].processLocally)).toBe(true);
 // Exercise real shell native registry, independent of GPU / map-provider availability.
 await page.evaluate(()=>window.voiceInstances[0].onresult({resultIndex:0,results:[Object.assign([{transcript:'open people'}],{isFinal:true})]}));
 await expect(dialog.getByRole('option')).toHaveCount(1);await expect(dialog).toBeVisible();await expect(page.locator('#launch-panel')).not.toBeVisible();
 await page.screenshot({path:`.mini-symphony-evidence/SHE-783-confirm-${mobile?'mobile':'desktop'}.png`});
 await input.press('Enter');await expect(dialog).not.toBeVisible();await expect(page.locator('#launch-panel')).toBeVisible();
 await page.keyboard.press('Escape');await page.keyboard.press('Control+k');await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Use voice',exact:true}).click();await page.evaluate(()=>window.voiceInstances.at(-1).onerror({error:'not-allowed'}));await expect(dialog).toContainText('access denied');
 await dialog.getByRole('button',{name:'Use voice',exact:true}).click();await page.evaluate(()=>window.voiceInstances.at(-1).onresult({results:[Object.assign([{transcript:'why did rent change?'}],{isFinal:true})]}));await expect(dialog.getByRole('option')).toHaveCount(0);await expect(dialog).toContainText('No available command');
 await input.press('Escape');await page.evaluate(()=>delete window.SpeechRecognition);await page.keyboard.press('Control+k');await dialog.getByRole('button',{name:'Use voice',exact:true}).click();await expect(dialog).toContainText('typed command search');await expect(input).toBeFocused();
 const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(mobile?390:1440);
});
