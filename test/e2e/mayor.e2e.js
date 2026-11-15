import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const evidence='.mini-symphony-evidence';
test('mayor normal entry, budget, timer, real outcomes and responsive evidence',async({page})=>{
 mkdirSync(evidence,{recursive:true});
 // Render the checkout's unchanged page shell before adding mayor mode.
 const before=execFileSync('git',['show','HEAD:world/challenges.html'],{encoding:'utf8'});
 await page.route('**/world/challenges.html',r=>r.fulfill({contentType:'text/html',body:before}));
 await page.goto('/world/challenges.html');await expect(page.locator('#missions button')).toHaveCount(6);
 await page.screenshot({path:`${evidence}/SHE-571-challenges-before-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${evidence}/SHE-571-challenges-before-mobile.png`,fullPage:true});
 await page.unroute('**/world/challenges.html');await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
 const root=page.getByRole('region',{name:'Five-minute mayor',exact:true});
 await expect(root.locator('#mayor-status')).toContainText('Frozen terms ready');
 await expect(root.locator('#mayor-run')).toBeDisabled();
 await root.locator('#mayor-timed').check();await root.getByRole('button',{name:'Pause timer',exact:true}).click();
 const clock=await root.locator('#mayor-clock').textContent();await page.waitForTimeout(1100);await expect(root.locator('#mayor-clock')).toHaveText(clock);
 await root.locator('#mayor-timed').uncheck();
 for(const id of ['homes-large','transit-large','protection-large'])await root.locator(`input[value="${id}"]`).check();
 await expect(root.locator('#mayor-budget')).toContainText('Over budget');await expect(root.locator('#mayor-run')).toBeDisabled();
 for(const id of ['homes-small','transit-small','protection-small'])await root.locator(`input[value="${id}"]`).check();
 await root.locator('#mayor-run').focus();await page.keyboard.press('Enter');
 await expect(root.locator('#mayor-status')).toContainText('Comparison complete');
 await expect(root.locator('#mayor-results')).toContainText('your plan 15000');
 await expect(root.locator('#mayor-results table tr')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`${evidence}/SHE-571-challenges-after-mobile.png`,fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:`${evidence}/SHE-571-challenges-after-desktop.png`,fullPage:true});
 await root.locator('input[value="homes-large"]').check();await expect(root.locator('#mayor-results')).toBeHidden();
});
test('worker failure claims no outcome; no-worker low-end fallback computes the same budget',async({page})=>{
 await page.addInitScript(()=>{window.Worker=undefined;});await page.goto('/world/challenges.html');
 for(const id of ['homes-small','transit-small','protection-small'])await page.locator(`input[value="${id}"]`).check();
 await page.locator('#mayor-run').click();await expect(page.locator('#mayor-status')).toContainText('Comparison complete');
 await expect(page.locator('#mayor-results')).toContainText('your plan 15000');
 await page.evaluate(()=>{window.Worker=class{constructor(){throw Error('Controlled worker failure');}};});
 await page.locator('#mayor-run').click();await expect(page.locator('#mayor-status')).toContainText('Controlled worker failure');
 await expect(page.locator('#mayor-results')).toBeHidden();await expect(page.locator('#mayor-run')).toBeEnabled();
});
test('cancellation and unavailable preparation never claim outcomes',async({page})=>{
 await page.addInitScript(()=>{window.Worker=class{postMessage(){} terminate(){}};});
 await page.goto('/world/challenges.html');await expect(page.locator('#mayor-status')).toContainText('Frozen terms ready');
 for(const id of ['homes-small','transit-small','protection-small'])await page.locator(`input[value="${id}"]`).check();
 await page.locator('#mayor-run').click();await page.locator('#mayor-cancel').click();
 await expect(page.locator('#mayor-status')).toContainText('Run cancelled');await expect(page.locator('#mayor-results')).toBeHidden();
 await page.addInitScript(()=>{Object.defineProperty(window,'crypto',{value:{}});});await page.reload();
 await expect(page.locator('#mayor-status')).toContainText('WebCrypto');await expect(page.locator('#mayor-run')).toBeDisabled();
});
