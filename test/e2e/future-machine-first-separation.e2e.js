import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const evidence='.mini-symphony-evidence';
const ready=page=>expect.poll(()=>page.evaluate(()=>window.futureMachine?.state.status),{timeout:90000}).toBe('ready');
async function run(page){await page.getByRole('button',{name:'Fork City',exact:true}).click();await ready(page);}
for(const mobile of [false,true])test(`first separation shared clock/camera, keyboard, zero and cleanup ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 mkdirSync(evidence,{recursive:true});
 await page.goto('/world/future-machine.html?renderer=canvas2d');await run(page);
 const before=await page.evaluate(()=>JSON.stringify(window.futureMachine.history));
 const jump=page.getByRole('button',{name:'Jump to first divergence',exact:true});
 await expect(jump).toBeEnabled();await jump.focus();await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(1);
 await expect(page.locator('.fm-arm-heading').nth(0)).toContainText('Feb 2026 · Month 1');
 await expect(page.locator('.fm-arm-heading').nth(1)).toContainText('Feb 2026 · Month 1');
 await expect(page.locator('.fm-status')).toContainText('Shared overview');
 await page.screenshot({path:`${evidence}/SHE-507-future-after-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 const canvas=page.getByTestId('future-machine-stage').locator('canvas');
 for(const month of [120,0,70,16]){
  await page.getByTestId('future-machine-timeline').fill(String(month));
  await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('d');
  await expect.poll(()=>page.evaluate(()=>window.futureMachine.state.month)).toBe(1);
 }
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.mode)).toBe('split');
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.month)).toBe(1);
 expect(await page.evaluate(()=>window.futureMachine.state.playing)).toBe(false);
 expect(await page.evaluate(()=>JSON.stringify(window.futureMachine.history))).toBe(before);
 await page.getByRole('combobox',{name:'Plan',exact:true}).selectOption('baseline');await run(page);
 await expect(page.getByLabel('First divergence evidence')).toContainText('No divergence');
 await jump.click();await expect(page.locator('.fm-status')).toContainText('No divergence');
 expect(await page.evaluate(()=>window.futureMachine.state.month)).toBe(0);
 await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));});
 expect(await page.evaluate(()=>window.futureMachine.stats.scene.disposed)).toBe(true);
 expect(await page.getByTestId('future-machine-stage').locator('canvas').count()).toBe(0);
 await page.goto('/');expect(errors).toEqual([]);
});
